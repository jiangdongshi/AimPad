import { Router, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { pool } from '../db';
import { redis } from '../redis';
import { config } from '../config';
import { requireAuth, AuthRequest } from '../middleware/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const authRouter = Router();

// POST /api/auth/send-code — 发送验证码
authRouter.post('/send-code', async (req: AuthRequest, res: Response) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ error: '邮箱和用途不能为空' });
    }
    if (!['login', 'register'].includes(purpose)) {
      return res.status(400).json({ error: '用途必须是 login 或 register' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 冷却检查
    const cooldownKey = `cooldown:${email}`;
    const hasCooldown = await redis.get(cooldownKey);
    if (hasCooldown) {
      return res.status(429).json({ error: '验证码发送过于频繁，请稍后再试' });
    }

    const code = config.DEMO_CODE;
    const codeKey = `verify:${email}:${purpose}`;

    // 存入 Redis
    await redis.setex(codeKey, config.CODE_TTL_SECONDS, code);
    // 设置冷却
    await redis.setex(cooldownKey, config.SEND_COOLDOWN_SECONDS, '1');

    // 写入 MySQL 审计
    const expiresAt = new Date(Date.now() + config.CODE_TTL_SECONDS * 1000);
    await pool.execute(
      'INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, purpose, expiresAt]
    );

    res.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    console.error('[send-code error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/auth/register — 注册
authRouter.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, username } = req.body;

    if (!email || !code || !username) {
      return res.status(400).json({ error: '邮箱、验证码和用户名不能为空' });
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return res.status(400).json({ error: '用户名需 3-32 个字符，仅限字母、数字、下划线' });
    }

    // 验证码校验
    const codeKey = `verify:${email}:register`;
    const storedCode = await redis.get(codeKey);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    // 检查邮箱是否已注册
    const [existingEmail] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    // 检查用户名是否已存在
    const [existingUser] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ error: '该用户名已被占用' });
    }

    // 创建用户
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, '']
    );
    const userId = result.insertId;

    // 创建默认设置
    await pool.execute(
      'INSERT INTO user_settings (user_id) VALUES (?)',
      [userId]
    );

    // 标记验证码已使用
    await redis.del(codeKey);
    await pool.execute(
      'UPDATE verification_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1',
      [email, 'register']
    );

    // 签发 JWT
    const signOptions: SignOptions = { expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign(
      { id: userId, email, username },
      config.JWT_SECRET,
      signOptions
    );

    res.json({
      token,
      user: { id: userId, email, username, nickname: null, avatarUrl: null },
    });
  } catch (err) {
    console.error('[register error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/auth/login — 登录
authRouter.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: '邮箱和验证码不能为空' });
    }

    // 验证码校验
    const codeKey = `verify:${email}:login`;
    const storedCode = await redis.get(codeKey);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    // 查找用户
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, nickname, avatar_url FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }
    const user = users[0];

    // 更新登录时间
    await pool.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // 标记验证码已使用
    await redis.del(codeKey);
    await pool.execute(
      'UPDATE verification_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1',
      [email, 'login']
    );

    // 签发 JWT
    const signOptions: SignOptions = { expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign(
      { id: user.id, email, username: user.username },
      config.JWT_SECRET,
      signOptions
    );

    res.json({
      token,
      user: {
        id: user.id,
        email,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/auth/me — 获取当前用户信息
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, email, nickname, avatar_url, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const user = users[0];

    const [settings] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user!.id]
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
      settings: settings[0] || null,
    });
  } catch (err) {
    console.error('[me error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});
