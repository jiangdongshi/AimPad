import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const settingsRouter = Router();

// GET /api/settings — 获取当前用户设置
settingsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user!.id]
    );

    if (rows.length === 0) {
      // 如果没有设置记录，创建默认设置
      await pool.execute(
        'INSERT INTO user_settings (user_id) VALUES (?)',
        [req.user!.id]
      );
      const [newRows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [req.user!.id]
      );
      return res.json({ settings: formatSettings(newRows[0]) });
    }

    res.json({ settings: formatSettings(rows[0]) });
  } catch (err) {
    console.error('[get-settings error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /api/settings — 更新用户设置
settingsRouter.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const allowedFields = [
      'theme', 'locale',
      'crosshair_style', 'crosshair_color', 'crosshair_size',
      'fov', 'quality',
      'sound_enabled', 'sound_volume',
      'gamepad_deadzone', 'gamepad_sensitivity', 'gamepad_invert_y',
      'mouse_sensitivity', 'mouse_invert_y',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`\`${field}\` = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    values.push(req.user!.id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );

    // 如果没有更新到任何行，说明没有设置记录，需要先创建
    if (result.affectedRows === 0) {
      await pool.execute(
        'INSERT INTO user_settings (user_id) VALUES (?)',
        [req.user!.id]
      );
      // 重新执行更新
      const updateValues = values.slice(0, -1);
      updateValues.push(req.user!.id);
      await pool.execute(
        `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
        updateValues
      );
    }

    // 返回更新后的完整设置
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user!.id]
    );

    res.json({ settings: formatSettings(rows[0]) });
  } catch (err) {
    console.error('[update-settings error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/** 将数据库字段名 (snake_case) 转为前端字段名 (camelCase) */
function formatSettings(row: RowDataPacket) {
  if (!row) return null;
  return {
    theme: row.theme,
    locale: row.locale,
    crosshairStyle: row.crosshair_style,
    crosshairColor: row.crosshair_color,
    crosshairSize: row.crosshair_size,
    fov: row.fov,
    quality: row.quality,
    soundEnabled: Boolean(row.sound_enabled),
    soundVolume: Number(row.sound_volume),
    gamepadDeadzone: Number(row.gamepad_deadzone),
    gamepadSensitivity: Number(row.gamepad_sensitivity),
    gamepadInvertY: Boolean(row.gamepad_invert_y),
    mouseSensitivity: Number(row.mouse_sensitivity),
    mouseInvertY: Boolean(row.mouse_invert_y),
    updatedAt: row.updated_at,
  };
}
