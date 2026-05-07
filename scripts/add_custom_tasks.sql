-- ============================================
-- AimPad 自定义任务功能 SQL 增量脚本
-- 需要在 aimpad 数据库中执行
-- ============================================

USE `aimpad`;

-- --------------------------------------------
-- 1. 新增自定义任务配置表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `custom_tasks` (
  `id`              VARCHAR(32)      NOT NULL COMMENT '任务 ID',
  `user_id`         BIGINT UNSIGNED  DEFAULT NULL COMMENT '创建者用户 ID',
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

-- --------------------------------------------
-- 2. 为 user_settings 添加手柄开火按钮字段
--    (如果表中没有此字段，需要执行此 ALTER)
-- --------------------------------------------
-- 注意：如果执行时报错 "Duplicate column name"，说明字段已存在，忽略该错误即可
ALTER TABLE `user_settings`
  ADD COLUMN `gamepad_fire_button` VARCHAR(16) NOT NULL DEFAULT 'RT' COMMENT '手柄开火按钮'
  AFTER `mouse_invert_y`;

-- --------------------------------------------
-- 3. 验证表结构
-- --------------------------------------------
SELECT 'custom_tasks 表结构:' AS '';
DESCRIBE `custom_tasks`;

SELECT 'user_settings 表结构 (gamepad_fire_button 字段):' AS '';
DESCRIBE `user_settings`;

-- --------------------------------------------
-- 4. 查看所有表
-- --------------------------------------------
SHOW TABLES;

-- ============================================
-- 执行完毕
-- 如需撤销此脚本，执行:
-- DROP TABLE IF EXISTS `custom_tasks`;
-- ALTER TABLE `user_settings` DROP COLUMN `gamepad_fire_button`;
-- ============================================
