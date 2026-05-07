# 瞄点 · AimPad 项目数据库设计手册

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 现有数据存储分析](#2-现有数据存储分析)
  - [2.1 前端存储现状](#21-前端存储现状)
  - [2.2 需要持久化的数据](#22-需要持久化的数据)
- [3. 数据库选型](#3-数据库选型)
- [4. 表结构设计](#4-表结构设计)
  - [4.1 用户表 `users`](#41-用户表-users)
  - [4.2 用户设置表 `user_settings`](#42-用户设置表-user_settings)
  - [4.3 训练记录表 `training_records`](#43-训练记录表-training_records)
  - [4.4 每日统计快照表 `daily_stats`](#44-每日统计快照表-daily_stats)
  - [4.5 训练任务配置表 `training_tasks`](#45-训练任务配置表-training_tasks)
- [5. 表关系与 ER 图](#5-表关系与-er-图)
- [6. 索引设计](#6-索引设计)
- [7. 常用查询示例](#7-常用查询示例)
- [8. 完整建表 SQL](#8-完整建表-sql)
- [9. 前端迁移方案](#9-前端迁移方案)
  - [9.1 IndexedDB → MySQL](#91-indexeddb--mysql)
  - [9.2 localStorage → MySQL](#92-localstorage--mysql)
  - [9.3 离线优先策略](#93-离线优先策略)
- [10. 后端 API 设计](#10-后端-api-设计)
- [11. 安全与性能](#11-安全与性能)
- [附录 A：数据字典](#附录-a数据字典)
- [附录 B：预留扩展字段](#附录-b预留扩展字段)

---

## 1. 背景与目标

### 1.1 背景

AimPad 是一个 Web 端专业瞄准训练平台，目前所有用户数据存储在浏览器本地：

| 存储方式 | 存储内容 | 局限性 |
|----------|----------|--------|
| IndexedDB (`AimPadDB`) | 训练记录（`TrainingResult`） | 换浏览器/清缓存即丢失，无法跨设备同步 |
| localStorage (`aimpad-settings`) | 用户设置（主题、准星、灵敏度等） | 同上，且有 5MB 大小限制 |
| Zustand 内存 | 游戏运行时状态 | 页面刷新即丢失（符合预期） |

### 1.2 目标

将需要持久化的数据迁移到 MySQL，实现：

- 用户注册/登录，数据绑定到账号
- 训练记录云端存储，跨设备同步
- 用户设置云端同步
- 历史数据统计分析（排行榜、趋势图等）
- 数据安全备份

### 1.3 非目标

以下数据**不需要**入库：

| 数据 | 原因 |
|------|------|
| 游戏运行时状态（`gameStore`） | 临时状态，页面刷新即重置，符合预期 |
| 3D 场景渲染数据 | 由 Babylon.js 引擎实时计算 |
| 训练任务硬编码配置 | 6 个预设任务定义在代码中，变更频率极低 |

---

## 2. 现有数据存储分析

### 2.1 前端存储现状

#### IndexedDB 存储结构

数据库名：`AimPadDB`，版本：`1`，对象存储：`training`

```
TrainingResult {
  id: string              // 主键
  taskId: string          // 索引：任务 ID
  timestamp: number       // 索引：时间戳
  score: number
  accuracy: number        // 0~100
  reactionTime: number    // 毫秒
  reactionTimes: number[] // 每次反应时间数组
  kills: number
  misses: number
  duration: number        // 毫秒
  metadata?: Record<string, unknown>
}
```

#### localStorage 存储结构

键名：`aimpad-settings`

```
SettingsState {
  theme: ThemeId           // 'default' | 'midnight' | 'forest' | 'purple' | 'chinese' | 'light' | 'cream' | 'cool-light'
  locale: LocaleId         // 'en' | 'zh'
  gamepadDeadzone: number  // 0~0.5
  gamepadSensitivity: number
  gamepadInvertY: boolean
  mouseSensitivity: number
  mouseInvertY: boolean
  crosshairStyle: 'dot' | 'cross' | 'circle'
  crosshairColor: string   // HEX 颜色值
  crosshairSize: number    // 2~12
  fov: number
  quality: 'low' | 'medium' | 'high' | 'ultra'
  soundEnabled: boolean
  soundVolume: number      // 0~1
}
```

### 2.2 需要持久化的数据

| 数据类别 | 当前存储 | 目标存储 | 优先级 |
|----------|----------|----------|--------|
| 用户账户信息 | 无 | MySQL `users` | P0 |
| 训练记录 | IndexedDB | MySQL `training_records` | P0 |
| 用户设置 | localStorage | MySQL `user_settings` | P1 |
| 每日统计聚合 | 实时计算 | MySQL `daily_stats` | P1 |
| 训练任务配置 | 代码硬编码 | MySQL `training_tasks` | P2 |

---

## 3. 数据库选型

### 3.1 选型理由

| 方案 | 适用场景 | 选择 |
|------|----------|------|
| **MySQL 8.0** | 结构化数据、关系查询、事务支持 | **选用** |
| PostgreSQL | 复杂查询、JSON 高级操作 | 功能过剩 |
| MongoDB | 灵活 Schema | 训练记录结构固定，不需要 |

### 3.2 字符集与排序规则

```sql
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
```

支持完整 Unicode（包括 emoji），排序规则兼容中文。

---

## 4. 表结构设计

### 4.1 用户表 `users`

存储注册用户的基本信息。

```sql
CREATE TABLE `users` (
  `id`             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '用户 ID',
  `username`       VARCHAR(32)      NOT NULL COMMENT '用户名',
  `email`          VARCHAR(128)     NOT NULL COMMENT '邮箱',
  `password_hash`  VARCHAR(128)     NOT NULL COMMENT '密码哈希 (bcrypt)',
  `avatar_url`     VARCHAR(256)     DEFAULT NULL COMMENT '头像 URL',
  `nickname`       VARCHAR(64)      DEFAULT NULL COMMENT '昵称（显示用）',
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login_at`  DATETIME         DEFAULT NULL COMMENT '最后登录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

**字段说明：**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, 自增 | 主键，用于关联其他表 |
| `username` | VARCHAR(32) | UNIQUE, NOT NULL | 登录用，3~32 字符，只允许字母数字下划线 |
| `email` | VARCHAR(128) | UNIQUE, NOT NULL | 邮箱，用于找回密码 |
| `password_hash` | VARCHAR(128) | NOT NULL | bcrypt 哈希后的密码，60 字符，预留长度 |
| `avatar_url` | VARCHAR(256) | NULLABLE | 头像地址，可为空使用默认头像 |
| `nickname` | VARCHAR(64) | NULLABLE | 显示名称，为空时显示 username |
| `created_at` | DATETIME | DEFAULT NOW() | 注册时间，不可修改 |
| `updated_at` | DATETIME | ON UPDATE NOW() | 最后修改时间，自动更新 |
| `last_login_at` | DATETIME | NULLABLE | 最后登录时间，每次登录更新 |

---

### 4.2 用户设置表 `user_settings`

存储用户的个性化设置，与用户一对一关系。

```sql
CREATE TABLE `user_settings` (
  `user_id`              BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `theme`                VARCHAR(16)      NOT NULL DEFAULT 'default' COMMENT '主题',
  `locale`               VARCHAR(8)       NOT NULL DEFAULT 'en' COMMENT '语言',
  `crosshair_style`      VARCHAR(16)      NOT NULL DEFAULT 'dot' COMMENT '准星样式',
  `crosshair_color`      VARCHAR(16)      NOT NULL DEFAULT '#00ff00' COMMENT '准星颜色',
  `crosshair_size`       TINYINT UNSIGNED NOT NULL DEFAULT 4 COMMENT '准星大小 (px)',
  `fov`                  SMALLINT UNSIGNED NOT NULL DEFAULT 90 COMMENT '视场角',
  `quality`              VARCHAR(16)      NOT NULL DEFAULT 'high' COMMENT '画质',
  `sound_enabled`        TINYINT(1)       NOT NULL DEFAULT 1 COMMENT '是否启用音效',
  `sound_volume`         DECIMAL(3,2)     NOT NULL DEFAULT 0.70 COMMENT '音量 (0.00~1.00)',
  `gamepad_deadzone`     DECIMAL(3,2)     NOT NULL DEFAULT 0.10 COMMENT '手柄死区 (0.00~0.50)',
  `gamepad_sensitivity`  DECIMAL(3,1)     NOT NULL DEFAULT 1.0 COMMENT '手柄灵敏度',
  `gamepad_invert_y`     TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '手柄反转 Y 轴',
  `mouse_sensitivity`    DECIMAL(3,1)     NOT NULL DEFAULT 1.0 COMMENT '鼠标灵敏度',
  `mouse_invert_y`       TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '鼠标反转 Y 轴',
  `updated_at`           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_setting_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设置表';
```

**字段说明：**

| 字段 | 类型 | 默认值 | 对应前端字段 |
|------|------|--------|-------------|
| `user_id` | BIGINT UNSIGNED | - | 关联 `users.id` |
| `theme` | VARCHAR(16) | `'default'` | `settingsStore.theme` |
| `locale` | VARCHAR(8) | `'en'` | `settingsStore.locale` |
| `crosshair_style` | VARCHAR(16) | `'dot'` | `settingsStore.crosshairStyle` |
| `crosshair_color` | VARCHAR(16) | `'#00ff00'` | `settingsStore.crosshairColor` |
| `crosshair_size` | TINYINT UNSIGNED | `4` | `settingsStore.crosshairSize` |
| `fov` | SMALLINT UNSIGNED | `90` | `settingsStore.fov` |
| `quality` | VARCHAR(16) | `'high'` | `settingsStore.quality` |
| `sound_enabled` | TINYINT(1) | `1` | `settingsStore.soundEnabled` |
| `sound_volume` | DECIMAL(3,2) | `0.70` | `settingsStore.soundVolume` |
| `gamepad_deadzone` | DECIMAL(3,2) | `0.10` | `settingsStore.gamepadDeadzone` |
| `gamepad_sensitivity` | DECIMAL(3,1) | `1.0` | `settingsStore.gamepadSensitivity` |
| `gamepad_invert_y` | TINYINT(1) | `0` | `settingsStore.gamepadInvertY` |
| `mouse_sensitivity` | DECIMAL(3,1) | `1.0` | `settingsStore.mouseSensitivity` |
| `mouse_invert_y` | TINYINT(1) | `0` | `settingsStore.mouseInvertY` |

**更新策略：** 使用 `REPLACE INTO` 或 `INSERT ... ON DUPLICATE KEY UPDATE`，用户每次修改设置时全量写入。

---

### 4.3 训练记录表 `training_records`

核心表，存储每次训练的完整结果。数据量最大。

```sql
CREATE TABLE `training_records` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录 ID',
  `user_id`         BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `task_id`         VARCHAR(32)      NOT NULL COMMENT '任务 ID',
  `score`           INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '得分',
  `accuracy`        DECIMAL(5,2)     NOT NULL DEFAULT 0.00 COMMENT '命中率 (0.00~100.00)',
  `reaction_time`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '平均反应时间 (ms)',
  `kills`           INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '命中数',
  `misses`          INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '脱靶数',
  `duration`        INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '训练时长 (ms)',
  `reaction_times`  JSON             DEFAULT NULL COMMENT '每次反应时间数组',
  `metadata`        JSON             DEFAULT NULL COMMENT '扩展元数据',
  `played_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '训练时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_task` (`user_id`, `task_id`),
  INDEX `idx_user_played` (`user_id`, `played_at`),
  INDEX `idx_task_score` (`task_id`, `score` DESC),
  CONSTRAINT `fk_record_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='训练记录表';
```

**字段映射（TrainingResult → training_records）：**

| TrainingResult 字段 | MySQL 字段 | 类型 | 说明 |
|---------------------|-----------|------|------|
| `id` | `id` | BIGINT UNSIGNED | 前端 UUID → 后端自增 |
| `taskId` | `task_id` | VARCHAR(32) | 如 `gridshot`, `spidershot` |
| `timestamp` | `played_at` | DATETIME | 毫秒时间戳 → 日期时间 |
| `score` | `score` | INT UNSIGNED | |
| `accuracy` | `accuracy` | DECIMAL(5,2) | 保留 2 位小数 |
| `reactionTime` | `reaction_time` | INT UNSIGNED | 毫秒 |
| `reactionTimes` | `reaction_times` | JSON | 数组存为 JSON |
| `kills` | `kills` | INT UNSIGNED | |
| `misses` | `misses` | INT UNSIGNED | |
| `duration` | `duration` | INT UNSIGNED | 毫秒 |
| `metadata` | `metadata` | JSON | 扩展字段 |

**JSON 字段示例：**

```json
// reaction_times
[180, 220, 195, 310, 175, 240, 200, 185, 260, 190]

// metadata（预留）
{
  "device": "gamepad",
  "platform": "xbox",
  "avgFps": 120,
  "browserVersion": "Chrome/126"
}
```

---

### 4.4 每日统计快照表 `daily_stats`

预聚合表，避免每次查询统计都扫描全量训练记录。

```sql
CREATE TABLE `daily_stats` (
  `id`                BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录 ID',
  `user_id`           BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `task_id`           VARCHAR(32)      NOT NULL DEFAULT '__all__' COMMENT '任务 ID（__all__ 表示全部）',
  `stat_date`         DATE             NOT NULL COMMENT '统计日期',
  `total_sessions`    INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '训练次数',
  `total_duration`    INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总训练时长 (ms)',
  `best_score`        INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '最高分',
  `total_score`       BIGINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '总得分（用于计算平均值）',
  `total_accuracy`    DECIMAL(10,2)    NOT NULL DEFAULT 0.00 COMMENT '总命中率（用于计算平均值）',
  `total_reaction`    BIGINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '总反应时间（用于计算平均值）',
  `total_kills`       INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总命中数',
  `total_misses`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总脱靶数',
  `updated_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_task_date` (`user_id`, `task_id`, `stat_date`),
  INDEX `idx_user_date` (`user_id`, `stat_date`),
  CONSTRAINT `fk_daily_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日统计快照表';
```

**设计说明：**

- `task_id = '__all__'` 表示该行是该用户当天所有任务的汇总
- 存储累加值（`total_score`, `total_accuracy` 等）而非平均值，新增记录时只需 `UPDATE ... SET total_score = total_score + ?`，避免重新扫描
- 平均值在查询时计算：`total_score / total_sessions`

**更新逻辑：**

```sql
INSERT INTO daily_stats (user_id, task_id, stat_date, total_sessions, total_duration, best_score, total_score, total_accuracy, total_reaction, total_kills, total_misses)
VALUES (?, ?, CURDATE(), 1, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  total_sessions  = total_sessions + 1,
  total_duration  = total_duration + VALUES(total_duration),
  best_score      = GREATEST(best_score, VALUES(best_score)),
  total_score     = total_score + VALUES(total_score),
  total_accuracy  = total_accuracy + VALUES(total_accuracy),
  total_reaction  = total_reaction + VALUES(total_reaction),
  total_kills     = total_kills + VALUES(total_kills),
  total_misses    = total_misses + VALUES(total_misses);
```

---

### 4.5 训练任务配置表 `training_tasks`

系统预设任务表。当前 6 个预设任务定义在此表中，可通过运营配置调整。

```sql
CREATE TABLE `training_tasks` (
  `id`                VARCHAR(32)      NOT NULL COMMENT '任务 ID',
  `name`              VARCHAR(64)      NOT NULL COMMENT '任务名称',
  `name_zh`           VARCHAR(64)      DEFAULT NULL COMMENT '任务中文名',
  `type`              VARCHAR(32)      NOT NULL COMMENT '任务类型',
  `description`       VARCHAR(256)     DEFAULT NULL COMMENT '任务描述',
  `difficulty`        VARCHAR(16)      NOT NULL DEFAULT 'beginner' COMMENT '难度',
  `duration`          INT UNSIGNED     NOT NULL DEFAULT 30000 COMMENT '训练时长 (ms)',
  `parameters`        JSON             NOT NULL COMMENT '任务参数',
  `scoring`           JSON             NOT NULL COMMENT '评分权重',
  `icon`              VARCHAR(64)      DEFAULT NULL COMMENT '图标',
  `is_active`         TINYINT(1)       NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order`        INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='训练任务配置表';
```

**预设任务数据：**

```sql
INSERT INTO `training_tasks` (`id`, `name`, `name_zh`, `type`, `description`, `difficulty`, `duration`, `parameters`, `scoring`) VALUES
('gridshot',      'Gridshot',      '网格射击',  'static-clicking',    '快速点击网格中的固定目标，训练基础定位能力',        'beginner',      30000, '{"targetCount":3,"targetSize":0.8,"targetSpeed":0,"spawnInterval":800,"minDistance":5,"maxDistance":10}',  '{"weightAccuracy":0.4,"weightSpeed":0.4,"weightConsistency":0.2}'),
('spidershot',    'Spidershot',    '蜘蛛射击',  'static-clicking',    '从中心向四周快速射击目标，训练大范围定位',          'beginner',      30000, '{"targetCount":1,"targetSize":0.6,"targetSpeed":0,"spawnInterval":1200,"minDistance":3,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('sphere-track',  'SphereTrack',   '球体追踪',  'tracking',           '持续追踪移动中的球体，训练跟枪平滑度',              'intermediate',  30000, '{"targetCount":1,"targetSize":1.2,"targetSpeed":3,"spawnInterval":0,"minDistance":5,"maxDistance":10}',   '{"weightAccuracy":0.6,"weightSpeed":0.1,"weightConsistency":0.3}'),
('strafe-track',  'StrafeTrack',   '移动追踪',  'tracking',           '追踪左右移动的目标，模拟实战跟枪',                  'intermediate',  30000, '{"targetCount":1,"targetSize":1.0,"targetSpeed":5,"spawnInterval":0,"minDistance":8,"maxDistance":15}',   '{"weightAccuracy":0.5,"weightSpeed":0.2,"weightConsistency":0.3}'),
('target-switch', 'TargetSwitch',  '目标切换',  'target-switching',   '在多个目标间快速切换，训练目标切换能力',            'intermediate',  30000, '{"targetCount":5,"targetSize":0.7,"targetSpeed":0,"spawnInterval":500,"minDistance":5,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('reflex-shot',   'ReflexShot',    '反射射击',  'reaction',           '目标随机出现并快速消失，训练反应速度',              'advanced',      30000, '{"targetCount":1,"targetSize":0.5,"targetSpeed":0,"spawnInterval":2000,"minDistance":5,"maxDistance":15}', '{"weightAccuracy":0.3,"weightSpeed":0.6,"weightConsistency":0.1}');
```

### 4.6 自定义任务配置表 `custom_tasks`

用户自定义训练任务配置表，支持分享码导入导出。

```sql
CREATE TABLE `custom_tasks` (
  `id`              VARCHAR(32)      NOT NULL COMMENT '任务 ID (自定义格式: custom-xxxxx)',
  `user_id`         BIGINT UNSIGNED  DEFAULT NULL COMMENT '创建者用户 ID (NULL=系统预设)',
  `share_code`      VARCHAR(16)      NOT NULL COMMENT '16位分享码 (唯一索引)',
  `name`            VARCHAR(64)      NOT NULL COMMENT '任务名称',
  `name_zh`         VARCHAR(64)      DEFAULT NULL COMMENT '任务中文名',
  `type`            VARCHAR(32)      NOT NULL COMMENT '任务类型',
  `description`     VARCHAR(256)     DEFAULT NULL COMMENT '任务描述',
  `difficulty`      VARCHAR(16)      NOT NULL DEFAULT 'beginner' COMMENT '推荐难度',
  `config`          JSON             NOT NULL COMMENT '完整场景配置 (SceneConfig)',
  `play_count`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '被游玩次数',
  `is_public`       TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '是否公开 (0=私有,1=公开)',
  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_code` (`share_code`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_public` (`is_public`, `play_count` DESC),
  CONSTRAINT `fk_custom_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义训练任务配置表';
```

**config 字段结构 (JSON)**：

```json
{
  "target": {
    "shape": "sphere",
    "size": 0.8,
    "color": "#FF3333",
    "glowIntensity": 0.5,
    "emissive": true
  },
  "movement": {
    "type": "static",
    "speed": 0,
    "bounds": { "xMin": -5, "xMax": 5, "yMin": 3, "yMax": 8 }
  },
  "spawn": {
    "mode": "interval",
    "interval": 800,
    "maxActive": 3,
    "lifetime": 0
  },
  "display": {
    "rows": 3,
    "cols": 5,
    "showLines": true,
    "lineColor": "#333344",
    "wallColor": "#1a1a2e",
    "wallHeight": 10
  },
  "scoring": {
    "weightAccuracy": 0.4,
    "weightSpeed": 0.4,
    "weightConsistency": 0.2
  },
  "difficultyPresets": {
    "easy": { "targetSizeMult": 1.5, "speedMult": 1.0, "lifetime": 0 },
    "normal": { "targetSizeMult": 1.0, "speedMult": 1.0, "lifetime": 0 },
    "hard": { "targetSizeMult": 0.5, "speedMult": 1.0, "lifetime": 2000 }
  }
}
```

**share_code 生成规则**：

```
share_code = Base64URL(CRC16(Config) + Config[0:12])
```

- 取配置 JSON 的前 12 个 Base64URL 字符
- 拼接 4 位 CRC16 校验码
- 总共 16 个字母数字字符

---

## 5. 表关系与 ER 图

```
┌──────────────┐       ┌───────────────────┐
│    users     │       │   user_settings   │
│──────────────│       │───────────────────│
│ PK id        │──1:1──│ PK/FK user_id     │
│ username     │       │ theme             │
│ email        │       │ locale            │
│ password_hash│       │ crosshair_*       │
│ avatar_url   │       │ gamepad_*         │
│ nickname     │       │ mouse_*           │
│ created_at   │       │ sound_*           │
│ updated_at   │       │ updated_at        │
│ last_login_at│       └───────────────────┘
└──────┬───────┘
       │
       │ 1:N
       │
┌──────┴───────┐       ┌───────────────────┐
│   training   │       │  training_tasks   │
│   _records   │       │───────────────────│
│──────────────│       │ PK id             │
│ PK id        │       │ name              │
│ FK user_id   │       │ name_zh           │
│ FK task_id ──│──N:1──│ type              │
│ score        │       │ description       │
│ accuracy     │       │ difficulty        │
│ reaction_time│       │ duration          │
│ kills        │       │ parameters (JSON) │
│ misses       │       │ scoring (JSON)    │
│ duration     │       │ is_active         │
│ reaction_*   │       └───────────────────┘
│ metadata     │
│ played_at    │
└──────┬───────┘
       │
       │ 1:N（按天聚合）
       │
┌──────┴───────┐
│  daily_stats │
│──────────────│
│ PK id        │
│ FK user_id   │
│ task_id      │
│ stat_date    │
│ total_sessions│
│ best_score   │
│ total_score  │
│ total_accuracy│
│ total_reaction│
└──────────────┘

┌─────────────────────────┐
│     custom_tasks         │
│─────────────────────────│
│ PK id                   │
│ FK user_id (可空)        │◄── 用户创建的自定义任务
│ UK share_code           │
│ name                    │
│ config (JSON)           │
│ play_count              │
│ is_public               │
└─────────────────────────┘
```

**关系说明：**

| 关系 | 类型 | 说明 |
|------|------|------|
| `users` ↔ `user_settings` | 1:1 | 一个用户一套设置，`user_id` 既是主键也是外键 |
| `users` ↔ `training_records` | 1:N | 一个用户多条训练记录 |
| `training_tasks` ↔ `training_records` | 1:N | 一个任务对应多条训练记录 |
| `users` ↔ `daily_stats` | 1:N | 一个用户多条每日统计 |

---

## 6. 索引设计

### 6.1 training_records 索引

| 索引名 | 字段 | 用途 | 查询场景 |
|--------|------|------|----------|
| `PRIMARY` | `id` | 主键 | 按 ID 查询单条记录 |
| `idx_user_task` | `(user_id, task_id)` | 用户+任务联合查询 | "我的 Gridshot 记录"、任务维度统计 |
| `idx_user_played` | `(user_id, played_at)` | 用户按时间查询 | "最近训练记录"、时间范围筛选 |
| `idx_task_score` | `(task_id, score DESC)` | 任务排行榜 | "Gridshot 全服 Top 100" |

### 6.2 daily_stats 索引

| 索引名 | 字段 | 用途 | 查询场景 |
|--------|------|------|----------|
| `PRIMARY` | `id` | 主键 | - |
| `uk_user_task_date` | `(user_id, task_id, stat_date)` | 唯一约束 + 查询 | 防止重复统计、按天查询 |
| `idx_user_date` | `(user_id, stat_date)` | 用户按天查询 | "最近 30 天训练趋势" |

### 6.3 索引使用示例

```sql
-- 命中 idx_user_task：查某用户某任务的记录
SELECT * FROM training_records WHERE user_id = 1 AND task_id = 'gridshot' ORDER BY played_at DESC LIMIT 50;

-- 命中 idx_user_played：查某用户最近 7 天记录
SELECT * FROM training_records WHERE user_id = 1 AND played_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 命中 idx_task_score：查某任务全服排行榜
SELECT u.username, r.score, r.accuracy FROM training_records r JOIN users u ON r.user_id = u.id WHERE r.task_id = 'gridshot' ORDER BY r.score DESC LIMIT 100;

-- 命中 idx_user_date：查某用户每日统计趋势
SELECT * FROM daily_stats WHERE user_id = 1 AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
```

---

## 7. 常用查询示例

### 7.1 用户相关

```sql
-- 注册
INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);
INSERT INTO user_settings (user_id) VALUES (LAST_INSERT_ID());

-- 登录
SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?;
UPDATE users SET last_login_at = NOW() WHERE id = ?;

-- 获取用户设置
SELECT * FROM user_settings WHERE user_id = ?;

-- 更新用户设置
REPLACE INTO user_settings (user_id, theme, locale, crosshair_style, ...) VALUES (?, ?, ?, ?, ...);
```

### 7.2 训练记录相关

```sql
-- 保存训练记录
INSERT INTO training_records (user_id, task_id, score, accuracy, reaction_time, kills, misses, duration, reaction_times, metadata, played_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000));

-- 获取用户某任务的记录（分页）
SELECT * FROM training_records WHERE user_id = ? AND task_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?;

-- 获取用户最近的记录
SELECT * FROM training_records WHERE user_id = ? ORDER BY played_at DESC LIMIT ?;

-- 获取某任务最高分
SELECT MAX(score) AS best_score FROM training_records WHERE user_id = ? AND task_id = ?;
```

### 7.3 统计相关

```sql
-- 用户总体统计
SELECT
  COUNT(*)                    AS total_sessions,
  ROUND(AVG(score))           AS average_score,
  MAX(score)                  AS best_score,
  ROUND(AVG(accuracy), 1)    AS average_accuracy,
  ROUND(AVG(reaction_time))  AS average_reaction_time
FROM training_records
WHERE user_id = ?;

-- 用户某任务统计
SELECT
  COUNT(*)                    AS sessions,
  MAX(score)                  AS best_score,
  ROUND(AVG(score))           AS average_score,
  ROUND(AVG(accuracy), 1)    AS average_accuracy,
  MAX(played_at)              AS last_played
FROM training_records
WHERE user_id = ? AND task_id = ?;

-- 趋势（最近 10 次 vs 之前 10 次）
WITH ranked AS (
  SELECT score, ROW_NUMBER() OVER (ORDER BY played_at DESC) AS rn
  FROM training_records WHERE user_id = ?
),
recent AS (SELECT AVG(score) AS avg_score FROM ranked WHERE rn <= 10),
previous AS (SELECT AVG(score) AS avg_score FROM ranked WHERE rn BETWEEN 11 AND 20)
SELECT
  ROUND(r.avg_score) AS recent_avg,
  ROUND(p.avg_score) AS previous_avg,
  ROUND((r.avg_score - p.avg_score) / p.avg_score * 100, 1) AS trend
FROM recent r, previous p;

-- 近 30 天每日训练趋势
SELECT
  stat_date,
  total_sessions,
  ROUND(total_score / total_sessions) AS avg_score,
  ROUND(total_accuracy / total_sessions, 1) AS avg_accuracy,
  ROUND(total_reaction / total_sessions) AS avg_reaction
FROM daily_stats
WHERE user_id = ? AND task_id = '__all__' AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY stat_date;
```

### 7.4 排行榜

```sql
-- 某任务全服 Top 100
SELECT
  u.username,
  u.avatar_url,
  MAX(r.score) AS best_score,
  COUNT(*) AS attempts
FROM training_records r
JOIN users u ON r.user_id = u.id
WHERE r.task_id = ?
GROUP BY r.user_id
ORDER BY best_score DESC
LIMIT 100;

-- 某任务本周排行榜
SELECT
  u.username,
  MAX(r.score) AS best_score
FROM training_records r
JOIN users u ON r.user_id = u.id
WHERE r.task_id = ? AND r.played_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY r.user_id
ORDER BY best_score DESC
LIMIT 50;
```

---

## 8. 完整建表 SQL

```sql
-- ============================================
-- AimPad 数据库初始化脚本
-- MySQL 8.0+
-- ============================================

CREATE DATABASE IF NOT EXISTS `aimpad`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `aimpad`;

-- --------------------------------------------
-- 1. 用户表
-- --------------------------------------------
CREATE TABLE `users` (
  `id`             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '用户 ID',
  `username`       VARCHAR(32)      NOT NULL COMMENT '用户名',
  `email`          VARCHAR(128)     NOT NULL COMMENT '邮箱',
  `password_hash`  VARCHAR(128)     NOT NULL COMMENT '密码哈希 (bcrypt)',
  `avatar_url`     VARCHAR(256)     DEFAULT NULL COMMENT '头像 URL',
  `nickname`       VARCHAR(64)      DEFAULT NULL COMMENT '昵称',
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login_at`  DATETIME         DEFAULT NULL COMMENT '最后登录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- --------------------------------------------
-- 2. 用户设置表
-- --------------------------------------------
CREATE TABLE `user_settings` (
  `user_id`              BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `theme`                VARCHAR(16)      NOT NULL DEFAULT 'default' COMMENT '主题',
  `locale`               VARCHAR(8)       NOT NULL DEFAULT 'en' COMMENT '语言',
  `crosshair_style`      VARCHAR(16)      NOT NULL DEFAULT 'dot' COMMENT '准星样式',
  `crosshair_color`      VARCHAR(16)      NOT NULL DEFAULT '#00ff00' COMMENT '准星颜色',
  `crosshair_size`       TINYINT UNSIGNED NOT NULL DEFAULT 4 COMMENT '准星大小 (px)',
  `fov`                  SMALLINT UNSIGNED NOT NULL DEFAULT 90 COMMENT '视场角',
  `quality`              VARCHAR(16)      NOT NULL DEFAULT 'high' COMMENT '画质',
  `sound_enabled`        TINYINT(1)       NOT NULL DEFAULT 1 COMMENT '是否启用音效',
  `sound_volume`         DECIMAL(3,2)     NOT NULL DEFAULT 0.70 COMMENT '音量',
  `gamepad_deadzone`     DECIMAL(3,2)     NOT NULL DEFAULT 0.10 COMMENT '手柄死区',
  `gamepad_sensitivity`  DECIMAL(3,1)     NOT NULL DEFAULT 1.0 COMMENT '手柄灵敏度',
  `gamepad_invert_y`     TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '手柄反转 Y 轴',
  `mouse_sensitivity`    DECIMAL(3,1)     NOT NULL DEFAULT 1.0 COMMENT '鼠标灵敏度',
  `mouse_invert_y`       TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '鼠标反转 Y 轴',
  `updated_at`           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_setting_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设置表';

-- --------------------------------------------
-- 3. 训练任务配置表
-- --------------------------------------------
CREATE TABLE `training_tasks` (
  `id`            VARCHAR(32)  NOT NULL COMMENT '任务 ID',
  `name`          VARCHAR(64)  NOT NULL COMMENT '任务英文名',
  `name_zh`       VARCHAR(64)  DEFAULT NULL COMMENT '任务中文名',
  `type`          VARCHAR(32)  NOT NULL COMMENT '任务类型',
  `description`   VARCHAR(256) DEFAULT NULL COMMENT '任务描述',
  `difficulty`    VARCHAR(16)  NOT NULL DEFAULT 'beginner' COMMENT '难度',
  `duration`      INT UNSIGNED NOT NULL DEFAULT 30000 COMMENT '训练时长 (ms)',
  `parameters`    JSON         NOT NULL COMMENT '任务参数',
  `scoring`       JSON         NOT NULL COMMENT '评分权重',
  `icon`          VARCHAR(64)  DEFAULT NULL COMMENT '图标',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='训练任务配置表';

-- --------------------------------------------
-- 4. 训练记录表
-- --------------------------------------------
CREATE TABLE `training_records` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录 ID',
  `user_id`         BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `task_id`         VARCHAR(32)      NOT NULL COMMENT '任务 ID',
  `score`           INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '得分',
  `accuracy`        DECIMAL(5,2)     NOT NULL DEFAULT 0.00 COMMENT '命中率',
  `reaction_time`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '平均反应时间 (ms)',
  `kills`           INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '命中数',
  `misses`          INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '脱靶数',
  `duration`        INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '训练时长 (ms)',
  `reaction_times`  JSON             DEFAULT NULL COMMENT '每次反应时间数组',
  `metadata`        JSON             DEFAULT NULL COMMENT '扩展元数据',
  `played_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '训练时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_task` (`user_id`, `task_id`),
  INDEX `idx_user_played` (`user_id`, `played_at`),
  INDEX `idx_task_score` (`task_id`, `score` DESC),
  CONSTRAINT `fk_record_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_record_task` FOREIGN KEY (`task_id`) REFERENCES `training_tasks`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='训练记录表';

-- --------------------------------------------
-- 5. 每日统计快照表
-- --------------------------------------------
CREATE TABLE `daily_stats` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录 ID',
  `user_id`         BIGINT UNSIGNED  NOT NULL COMMENT '用户 ID',
  `task_id`         VARCHAR(32)      NOT NULL DEFAULT '__all__' COMMENT '任务 ID（__all__=全部）',
  `stat_date`       DATE             NOT NULL COMMENT '统计日期',
  `total_sessions`  INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '训练次数',
  `total_duration`  INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总训练时长 (ms)',
  `best_score`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '最高分',
  `total_score`     BIGINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '总得分',
  `total_accuracy`  DECIMAL(10,2)    NOT NULL DEFAULT 0.00 COMMENT '总命中率',
  `total_reaction`  BIGINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '总反应时间',
  `total_kills`     INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总命中数',
  `total_misses`    INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '总脱靶数',
  `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_task_date` (`user_id`, `task_id`, `stat_date`),
  INDEX `idx_user_date` (`user_id`, `stat_date`),
  CONSTRAINT `fk_daily_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日统计快照表';

-- --------------------------------------------
-- 6. 自定义任务配置表
-- --------------------------------------------
CREATE TABLE `custom_tasks` (
  `id`              VARCHAR(32)      NOT NULL COMMENT '任务 ID',
  `user_id`         BIGINT UNSIGNED  DEFAULT NULL COMMENT '创建者用户 ID',
  `share_code`      VARCHAR(16)      NOT NULL COMMENT '分享码',
  `name`            VARCHAR(64)      NOT NULL COMMENT '任务名称',
  `name_zh`         VARCHAR(64)      DEFAULT NULL COMMENT '任务中文名',
  `type`            VARCHAR(32)      NOT NULL COMMENT '任务类型',
  `description`     VARCHAR(256)     DEFAULT NULL COMMENT '任务描述',
  `difficulty`      VARCHAR(16)      NOT NULL DEFAULT 'beginner' COMMENT '推荐难度',
  `config`          JSON             NOT NULL COMMENT '完整场景配置',
  `play_count`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '被游玩次数',
  `is_public`       TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '是否公开',
  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_code` (`share_code`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_public` (`is_public`, `play_count` DESC),
  CONSTRAINT `fk_custom_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义训练任务配置表';

-- --------------------------------------------
-- 7. 插入预设训练任务数据
-- --------------------------------------------
INSERT INTO `training_tasks` (`id`, `name`, `name_zh`, `type`, `description`, `difficulty`, `duration`, `parameters`, `scoring`) VALUES
('gridshot',      'Gridshot',      '网格射击',  'static-clicking',    '快速点击网格中的固定目标，训练基础定位能力',        'beginner',      30000, '{"targetCount":3,"targetSize":0.8,"targetSpeed":0,"spawnInterval":800,"minDistance":5,"maxDistance":10}',  '{"weightAccuracy":0.4,"weightSpeed":0.4,"weightConsistency":0.2}'),
('spidershot',    'Spidershot',    '蜘蛛射击',  'static-clicking',    '从中心向四周快速射击目标，训练大范围定位',          'beginner',      30000, '{"targetCount":1,"targetSize":0.6,"targetSpeed":0,"spawnInterval":1200,"minDistance":3,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('sphere-track',  'SphereTrack',   '球体追踪',  'tracking',           '持续追踪移动中的球体，训练跟枪平滑度',              'intermediate',  30000, '{"targetCount":1,"targetSize":1.2,"targetSpeed":3,"spawnInterval":0,"minDistance":5,"maxDistance":10}',   '{"weightAccuracy":0.6,"weightSpeed":0.1,"weightConsistency":0.3}'),
('strafe-track',  'StrafeTrack',   '移动追踪',  'tracking',           '追踪左右移动的目标，模拟实战跟枪',                  'intermediate',  30000, '{"targetCount":1,"targetSize":1.0,"targetSpeed":5,"spawnInterval":0,"minDistance":8,"maxDistance":15}',   '{"weightAccuracy":0.5,"weightSpeed":0.2,"weightConsistency":0.3}'),
('target-switch', 'TargetSwitch',  '目标切换',  'target-switching',   '在多个目标间快速切换，训练目标切换能力',            'intermediate',  30000, '{"targetCount":5,"targetSize":0.7,"targetSpeed":0,"spawnInterval":500,"minDistance":5,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('reflex-shot',   'ReflexShot',    '反射射击',  'reaction',           '目标随机出现并快速消失，训练反应速度',              'advanced',      30000, '{"targetCount":1,"targetSize":0.5,"targetSpeed":0,"spawnInterval":2000,"minDistance":5,"maxDistance":15}', '{"weightAccuracy":0.3,"weightSpeed":0.6,"weightConsistency":0.1}');
```

---

## 9. 前端迁移方案

### 9.1 IndexedDB → MySQL

当前 `trainingStorage`（`src/utils/storage.ts`）直接操作 IndexedDB。迁移后需要改为调用后端 API。

**迁移步骤：**

```
阶段 1：双写
  前端训练完成 → 同时写入 IndexedDB + POST /api/records
  读取时优先从 IndexedDB 读（保证离线可用）

阶段 2：数据迁移
  用户首次登录时，将 IndexedDB 中的历史记录批量上传
  POST /api/records/batch  { records: TrainingResult[] }

阶段 3：切换
  登录用户：只读写 MySQL（通过 API）
  未登录用户：继续使用 IndexedDB（游客模式）
```

**新建 `src/utils/api.ts`：**

```typescript
const API_BASE = '/api';

export const trainingApi = {
  // 保存训练记录
  async saveRecord(record: Omit<TrainingResult, 'id'>): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return res.json();
  },

  // 获取训练记录
  async getRecords(taskId?: string, limit = 50, offset = 0): Promise<TrainingResult[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (taskId) params.set('task_id', taskId);
    const res = await fetch(`${API_BASE}/records?${params}`);
    return res.json();
  },

  // 批量上传（迁移用）
  async batchUpload(records: TrainingResult[]): Promise<{ inserted: number }> {
    const res = await fetch(`${API_BASE}/records/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    return res.json();
  },
};
```

### 9.2 localStorage → MySQL

当前 `settingsStore` 通过 zustand `persist` 中间件自动同步到 localStorage。迁移后需要在登录时从 MySQL 加载，修改时同步到 MySQL。

**修改 `settingsStore.ts`：**

```typescript
// 登录后调用，从 MySQL 加载设置
async function loadSettingsFromServer() {
  const res = await fetch('/api/settings');
  const serverSettings = await res.json();
  useSettingsStore.getState().updateSettings(serverSettings);
}

// 修改设置时同步到服务器（防抖）
let saveTimer: number;
const originalUpdate = useSettingsStore.getState().updateSettings;
useSettingsStore.setState({
  updateSettings: (partial) => {
    originalUpdate(partial);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSettingsStore.getState()),
      });
    }, 1000); // 1 秒防抖
  },
});
```

### 9.3 离线优先策略

```
┌─────────────────────────────────────────────────────────┐
│                    训练完成                               │
│                        │                                 │
│                        ▼                                 │
│              ┌─────────────────┐                        │
│              │   用户已登录？   │                        │
│              └────────┬────────┘                        │
│                   是  │  否                              │
│              ┌────────┴────────┐                        │
│              ▼                 ▼                        │
│    ┌──────────────┐   ┌──────────────┐                 │
│    │ POST /api/   │   │ 写入 IndexedDB│                 │
│    │ records      │   │              │                 │
│    └──────┬───────┘   └──────────────┘                 │
│           │                                             │
│      失败？│                                             │
│      ┌────┴────┐                                       │
│      ▼         ▼                                       │
│   写入       完成                                       │
│  IndexedDB                                                │
│  + 标记待同步                                             │
│                                                           │
│  下次联网时批量上传标记的记录                              │
└─────────────────────────────────────────────────────────┘
```

---

## 10. 后端 API 设计

### 10.1 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录，返回 JWT |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/auth/me` | 获取当前用户信息 |

### 10.2 训练记录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/records` | 保存单条训练记录 |
| `POST` | `/api/records/batch` | 批量上传（迁移用） |
| `GET` | `/api/records` | 获取训练记录（支持 `?task_id=&limit=&offset=`） |
| `GET` | `/api/records/:id` | 获取单条记录详情 |
| `DELETE` | `/api/records/:id` | 删除单条记录 |

### 10.3 统计接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/stats/overview` | 用户总体统计 |
| `GET` | `/api/stats/task/:taskId` | 某任务统计 |
| `GET` | `/api/stats/tasks` | 所有任务统计汇总 |
| `GET` | `/api/stats/trend?days=30` | 近 N 天训练趋势 |
| `GET` | `/api/stats/skill-radar` | 技能雷达图数据 |

### 10.4 排行榜接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/leaderboard/:taskId?period=week` | 某任务排行榜（period: all/week/month） |
| `GET` | `/api/leaderboard/rank/:taskId` | 当前用户在某任务的排名 |

### 10.5 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/settings` | 获取用户设置 |
| `PUT` | `/api/settings` | 更新用户设置（全量替换） |

### 10.6 任务配置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tasks` | 获取所有启用的训练任务 |
| `GET` | `/api/tasks/:id` | 获取单个任务详情 |

### 10.7 自定义任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/custom-tasks` | 创建自定义任务 |
| `GET` | `/api/custom-tasks` | 获取当前用户的自定义任务列表 |
| `GET` | `/api/custom-tasks/:id` | 获取自定义任务详情 |
| `PUT` | `/api/custom-tasks/:id` | 更新自定义任务 |
| `DELETE` | `/api/custom-tasks/:id` | 删除自定义任务 |
| `GET` | `/api/custom-tasks/by-code/:shareCode` | 通过分享码获取任务（无需登录） |
| `POST` | `/api/custom-tasks/import` | 导入分享码创建任务 |
| `GET` | `/api/custom-tasks/public` | 获取公开任务列表（可按 play_count 排序） |

---

## 11. 安全与性能

### 11.1 安全措施

| 措施 | 说明 |
|------|------|
| 密码哈希 | 使用 bcrypt，cost factor = 12 |
| JWT 认证 | Access Token 有效期 2 小时，Refresh Token 7 天 |
| SQL 注入防护 | 使用参数化查询（Prepared Statements） |
| 接口限流 | 登录接口 5 次/分钟，普通接口 60 次/分钟 |
| 数据校验 | 后端对所有输入做类型和范围校验 |
| CORS | 仅允许前端域名 |

### 11.2 性能优化

| 优化项 | 方案 |
|--------|------|
| 训练记录查询 | 按 `(user_id, played_at)` 分区，每月一个分区 |
| 统计查询 | 使用 `daily_stats` 预聚合表，避免全表扫描 |
| 排行榜缓存 | Redis 缓存各任务 Top 100，5 分钟刷新 |
| 用户设置缓存 | Redis 缓存，修改时失效 |
| 连接池 | 最大连接数 100，与 Docker Compose 配置一致 |

### 11.3 数据备份

```bash
# 每日凌晨 3 点自动备份（复用 deploy.sh 中的备份脚本）
0 3 * * * /opt/aimpad/scripts/backup-mysql.sh >> /opt/aimpad/data/mysql/backup/backup.log 2>&1
```

---

## 附录 A：数据字典

### task_id 枚举值

| task_id | 英文名 | 中文名 | 类型 |
|---------|--------|--------|------|
| `gridshot` | Gridshot | 网格射击 | static-clicking |
| `spidershot` | Spidershot | 蜘蛛射击 | static-clicking |
| `sphere-track` | SphereTrack | 球体追踪 | tracking |
| `strafe-track` | StrafeTrack | 移动追踪 | tracking |
| `target-switch` | TargetSwitch | 目标切换 | target-switching |
| `reflex-shot` | ReflexShot | 反射射击 | reaction |
| `custom-*` | Custom Task | 自定义任务 | 用户创建 |

### custom_task type 枚举值

| type | 说明 |
|------|------|
| `static-clicking` | 静态点射 |
| `dynamic-clicking` | 动态点射 |
| `tracking` | 跟踪训练 |
| `target-switching` | 目标切换 |
| `reaction` | 反应训练 |

### difficulty 枚举值

| 值 | 中文 |
|----|------|
| `beginner` | 入门 |
| `intermediate` | 进阶 |
| `advanced` | 高级 |
| `expert` | 专家 |

### theme 枚举值

| 值 | 中文名 |
|----|--------|
| `default` | 深黑 |
| `midnight` | 午夜蓝 |
| `forest` | 森林绿 |
| `purple` | 皇家紫 |
| `chinese` | 中国红 |
| `light` | 纯白 |
| `cream` | 暖米 |
| `cool-light` | 冷灰 |

---

## 附录 B：预留扩展字段

`training_records.metadata` JSON 字段可存储以下信息：

```json
{
  "device": "gamepad | mouse",
  "platform": "xbox | playstation | switch | keyboard",
  "avgFps": 120,
  "browser": "Chrome",
  "browserVersion": "126.0.0.0",
  "os": "Windows",
  "osVersion": "11",
  "screenResolution": "1920x1080",
  "fov": 90,
  "quality": "high"
}
```

`daily_stats` 可扩展的聚合维度：

- 按设备类型分组（gamepad / mouse）
- 按难度分组（beginner / intermediate / advanced）
- 按时段分组（上午 / 下午 / 晚上）

---

**文档版本**：v1.1
**最后更新**：2026-05-06
**维护者**：@jiangdongshi
