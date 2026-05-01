-- ============================================
-- AimPad 认证功能数据库补丁脚本
-- MySQL 8.0+
-- 使用方式: docker exec -i mysql mysql -uroot -p'密码' < add-auth-tables.sql
-- ============================================

USE `aimpad`;

-- --------------------------------------------
-- 1. 新增验证码表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_codes` (
  `id`          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录 ID',
  `email`       VARCHAR(128)     NOT NULL COMMENT '邮箱',
  `code`        VARCHAR(8)       NOT NULL COMMENT '验证码',
  `purpose`     VARCHAR(16)      NOT NULL DEFAULT 'login' COMMENT '用途: login / register',
  `expires_at`  DATETIME         NOT NULL COMMENT '过期时间',
  `used`        TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '是否已使用',
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_email_purpose` (`email`, `purpose`),
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='验证码表';

-- --------------------------------------------
-- 2. 修改 users 表: password_hash 允许空值
--    验证码登录模式下不需要密码哈希
-- --------------------------------------------
ALTER TABLE `users`
  MODIFY COLUMN `password_hash` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '密码哈希 (bcrypt, 验证码登录可为空)';

-- ============================================
-- 补丁执行完成
-- 验证: USE aimpad; SHOW TABLES; DESC verification_codes;
-- ============================================
