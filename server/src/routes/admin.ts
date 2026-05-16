import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const adminRouter = Router();

// 所有 admin 路由都需要认证 + 管理员权限
adminRouter.use(requireAuth, requireAdmin);

// --------------------------------------------
// 用户管理
// --------------------------------------------

// GET /api/admin/users — 分页获取用户列表
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (search) {
      whereClause = 'WHERE username LIKE ? OR email LIKE ? OR nickname LIKE ?';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // 查询总数
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 查询用户列表
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT id, username, email, nickname, avatar_url, role, created_at, last_login_at
       FROM users ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        nickname: u.nickname,
        avatarUrl: u.avatar_url,
        role: u.role || 'user',
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('[admin get-users error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/admin/users/:id — 获取单个用户详情
adminRouter.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, email, nickname, avatar_url, role, created_at, last_login_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const u = users[0];
    res.json({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        nickname: u.nickname,
        avatarUrl: u.avatar_url,
        role: u.role || 'user',
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      },
    });
  } catch (err) {
    console.error('[admin get-user error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /api/admin/users/:id — 更新用户信息（role、nickname 等）
adminRouter.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { role, nickname } = req.body;
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: '角色必须是 user 或 admin' });
      }
      updates.push('`role` = ?');
      values.push(role);
    }
    if (nickname !== undefined) {
      updates.push('`nickname` = ?');
      values.push(nickname);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    values.push(parseInt(req.params.id));

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 返回更新后的用户
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, email, nickname, avatar_url, role, created_at, last_login_at FROM users WHERE id = ?',
      [req.params.id]
    );
    const u = users[0];
    res.json({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        nickname: u.nickname,
        avatarUrl: u.avatar_url,
        role: u.role || 'user',
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      },
    });
  } catch (err) {
    console.error('[admin update-user error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/admin/users/:id — 删除用户
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    // 不能删除自己
    if (userId === req.user!.id) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ success: true, message: '用户已删除' });
  } catch (err) {
    console.error('[admin delete-user error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// --------------------------------------------
// 训练项目管理
// --------------------------------------------

// GET /api/admin/tasks — 获取所有预设训练任务
adminRouter.get('/tasks', async (_req: AuthRequest, res: Response) => {
  try {
    const [tasks] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM training_tasks ORDER BY sort_order ASC, id ASC'
    );

    res.json({
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        nameZh: t.name_zh,
        type: t.type,
        description: t.description,
        duration: t.duration,
        parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
        scoring: typeof t.scoring === 'string' ? JSON.parse(t.scoring) : t.scoring,
        icon: t.icon,
        isActive: Boolean(t.is_active),
        sortOrder: t.sort_order,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    console.error('[admin get-tasks error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/admin/tasks — 创建预设训练任务
adminRouter.post('/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, nameZh, type, description, duration, parameters, scoring, icon, isActive, sortOrder } = req.body;

    if (!id || !name || !type || !parameters || !scoring) {
      return res.status(400).json({ error: '缺少必填字段 (id, name, type, parameters, scoring)' });
    }

    // 检查 ID 是否已存在
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM training_tasks WHERE id = ?',
      [id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '任务 ID 已存在' });
    }

    await pool.execute(
      `INSERT INTO training_tasks (id, name, name_zh, type, description, duration, parameters, scoring, icon, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, nameZh || null, type, description || null,
        duration || 30000, JSON.stringify(parameters), JSON.stringify(scoring),
        icon || null, isActive !== false ? 1 : 0, sortOrder || 0,
      ]
    );

    res.json({
      success: true,
      task: { id, name, nameZh, type, description, duration, parameters, scoring, icon, isActive, sortOrder },
    });
  } catch (err) {
    console.error('[admin create-task error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /api/admin/tasks/:id — 更新预设训练任务
adminRouter.put('/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const { name, nameZh, type, description, duration, parameters, scoring, icon, isActive, sortOrder } = req.body;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) { updates.push('`name` = ?'); values.push(name); }
    if (nameZh !== undefined) { updates.push('`name_zh` = ?'); values.push(nameZh); }
    if (type !== undefined) { updates.push('`type` = ?'); values.push(type); }
    if (description !== undefined) { updates.push('`description` = ?'); values.push(description); }
    if (duration !== undefined) { updates.push('`duration` = ?'); values.push(duration); }
    if (parameters !== undefined) { updates.push('`parameters` = ?'); values.push(JSON.stringify(parameters)); }
    if (scoring !== undefined) { updates.push('`scoring` = ?'); values.push(JSON.stringify(scoring)); }
    if (icon !== undefined) { updates.push('`icon` = ?'); values.push(icon); }
    if (isActive !== undefined) { updates.push('`is_active` = ?'); values.push(isActive ? 1 : 0); }
    if (sortOrder !== undefined) { updates.push('`sort_order` = ?'); values.push(sortOrder); }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    values.push(taskId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE training_tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 返回更新后的任务
    const [tasks] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM training_tasks WHERE id = ?',
      [taskId]
    );
    const t = tasks[0];
    res.json({
      task: {
        id: t.id,
        name: t.name,
        nameZh: t.name_zh,
        type: t.type,
        description: t.description,
        duration: t.duration,
        parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
        scoring: typeof t.scoring === 'string' ? JSON.parse(t.scoring) : t.scoring,
        icon: t.icon,
        isActive: Boolean(t.is_active),
        sortOrder: t.sort_order,
      },
    });
  } catch (err) {
    console.error('[admin update-task error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/admin/tasks/:id — 删除预设训练任务
adminRouter.delete('/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;

    // 检查是否有关联的训练记录
    const [records] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM training_records WHERE task_id = ?',
      [taskId]
    );
    if (records[0].count > 0) {
      return res.status(400).json({ error: '该任务有关联的训练记录，无法删除。可以改为禁用。' });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM training_tasks WHERE id = ?',
      [taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    res.json({ success: true, message: '任务已删除' });
  } catch (err) {
    console.error('[admin delete-task error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});
