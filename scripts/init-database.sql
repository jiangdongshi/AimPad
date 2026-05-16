-- ============================================
-- AimPad 数据库初始化脚本
-- MySQL 8.0+
-- 使用方式: mysql -u root -p < init-database.sql
-- 或容器内: docker exec -i mysql mysql -uroot -p < init-database.sql
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `aimpad`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `aimpad`;

-- --------------------------------------------
-- 1. 用户表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '用户 ID',
  `username`       VARCHAR(32)      NOT NULL COMMENT '用户名',
  `email`          VARCHAR(128)     NOT NULL COMMENT '邮箱',
  `password_hash`  VARCHAR(128)     NOT NULL COMMENT '密码哈希 (bcrypt)',
  `avatar_url`     VARCHAR(256)     DEFAULT NULL COMMENT '头像 URL',
  `nickname`       VARCHAR(64)      DEFAULT NULL COMMENT '昵称',
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login_at`  DATETIME         DEFAULT NULL COMMENT '最后登录时间',
  `role`           VARCHAR(16)      NOT NULL DEFAULT 'user' COMMENT '角色 (user/admin)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- --------------------------------------------
-- 2. 用户设置表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `user_settings` (
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
CREATE TABLE IF NOT EXISTS `training_tasks` (
  `id`            VARCHAR(32)  NOT NULL COMMENT '任务 ID',
  `name`          VARCHAR(64)  NOT NULL COMMENT '任务英文名',
  `name_zh`       VARCHAR(64)  DEFAULT NULL COMMENT '任务中文名',
  `type`          VARCHAR(32)  NOT NULL COMMENT '任务类型',
  `description`   VARCHAR(256) DEFAULT NULL COMMENT '任务描述',
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
CREATE TABLE IF NOT EXISTS `training_records` (
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
CREATE TABLE IF NOT EXISTS `daily_stats` (
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
-- 6. 插入预设训练任务数据
-- --------------------------------------------
INSERT INTO `training_tasks` (`id`, `name`, `name_zh`, `type`, `description`, `duration`, `parameters`, `scoring`) VALUES
('gridshot',      'Gridshot',      '网格射击',  'static-clicking',    '快速点击网格中的固定目标，训练基础定位能力',        30000, '{"targetCount":3,"targetSize":0.8,"targetSpeed":0,"spawnInterval":800,"minDistance":5,"maxDistance":10}',  '{"weightAccuracy":0.4,"weightSpeed":0.4,"weightConsistency":0.2}'),
('spidershot',    'Spidershot',    '蜘蛛射击',  'static-clicking',    '从中心向四周快速射击目标，训练大范围定位',          30000, '{"targetCount":1,"targetSize":0.6,"targetSpeed":0,"spawnInterval":1200,"minDistance":3,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('sphere-track',  'SphereTrack',   '球体追踪',  'tracking',           '持续追踪移动中的球体，训练跟枪平滑度',              30000, '{"targetCount":1,"targetSize":1.2,"targetSpeed":3,"spawnInterval":0,"minDistance":5,"maxDistance":10}',   '{"weightAccuracy":0.6,"weightSpeed":0.1,"weightConsistency":0.3}'),
('strafe-track',  'StrafeTrack',   '移动追踪',  'tracking',           '追踪左右移动的目标，模拟实战跟枪',                  30000, '{"targetCount":1,"targetSize":1.0,"targetSpeed":5,"spawnInterval":0,"minDistance":8,"maxDistance":15}',   '{"weightAccuracy":0.5,"weightSpeed":0.2,"weightConsistency":0.3}'),
('target-switch', 'TargetSwitch',  '目标切换',  'target-switching',   '在多个目标间快速切换，训练目标切换能力',            30000, '{"targetCount":5,"targetSize":0.7,"targetSpeed":0,"spawnInterval":500,"minDistance":5,"maxDistance":12}', '{"weightAccuracy":0.3,"weightSpeed":0.5,"weightConsistency":0.2}'),
('reflex-shot',   'ReflexShot',    '反射射击',  'reaction',           '目标随机出现并快速消失，训练反应速度',              30000, '{"targetCount":1,"targetSize":0.5,"targetSpeed":0,"spawnInterval":2000,"minDistance":5,"maxDistance":15}', '{"weightAccuracy":0.3,"weightSpeed":0.6,"weightConsistency":0.1}')
ON DUPLICATE KEY UPDATE
  `name`        = VALUES(`name`),
  `name_zh`     = VALUES(`name_zh`),
  `type`        = VALUES(`type`),
  `description` = VALUES(`description`),
  `duration`    = VALUES(`duration`),
  `parameters`  = VALUES(`parameters`),
  `scoring`     = VALUES(`scoring`);

-- --------------------------------------------
-- 7. 创建专用数据库用户（可选）
-- --------------------------------------------
-- 如果不想用 root 连接，取消下面的注释创建专用用户
-- CREATE USER IF NOT EXISTS 'aimpad'@'%' IDENTIFIED BY 'your_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON `aimpad`.* TO 'aimpad'@'%';
-- FLUSH PRIVILEGES;

-- ============================================
-- 初始化完成
-- 验证: USE aimpad; SHOW TABLES;
-- ============================================
