# 瞄点 · AimPad 用户认证系统设计手册

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 架构设计](#2-架构设计)
- [3. 认证流程](#3-认证流程)
  - [3.1 注册流程](#31-注册流程)
  - [3.2 登录流程](#32-登录流程)
  - [3.3 密码找回流程](#33-密码找回流程)
  - [3.4 Token 验证流程](#34-token-验证流程)
- [4. 后端 API 设计](#4-后端-api-设计)
  - [4.1 发送验证码](#41-发送验证码)
  - [4.2 用户注册](#42-用户注册)
  - [4.3 用户登录](#43-用户登录)
  - [4.4 重置密码](#44-重置密码)
  - [4.5 获取当前用户信息](#45-获取当前用户信息)
  - [4.6 健康检查](#46-健康检查)
- [5. 前端实现](#5-前端实现)
  - [5.1 页面组件](#51-页面组件)
  - [5.2 状态管理](#52-状态管理)
  - [5.3 API 客户端](#53-api-客户端)
  - [5.4 类型定义](#54-类型定义)
  - [5.5 国际化](#55-国际化)
- [6. 数据存储](#6-数据存储)
  - [6.1 Redis 存储](#61-redis-存储)
  - [6.2 MySQL 存储](#62-mysql-存储)
- [7. 安全设计](#7-安全设计)
- [8. 部署配置](#8-部署配置)
- [9. 文件清单](#9-文件清单)

---

## 1. 背景与目标

### 1.1 背景

AimPad 原为纯前端 SPA 应用，无用户系统，所有数据存储在浏览器本地。为实现跨设备数据同步和用户管理，需要新增后端 API 服务和用户认证系统。

### 1.2 目标

- 实现邮箱 + 验证码方式的注册和登录
- 支持密码找回（验证码重置密码）
- 基于 JWT 的无状态会话管理
- 前端路由守卫和用户状态持久化
- 演示模式下验证码固定为 `1234`

### 1.3 技术栈

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 后端框架 | Express.js + TypeScript | 轻量级 Node.js Web 框架 |
| 数据库 | MySQL 8.0 | 用户数据持久化 |
| 缓存 | Redis 7 (ioredis) | 验证码存储、冷却控制 |
| 认证 | JWT (jsonwebtoken) | 无状态令牌认证 |
| 密码加密 | bcryptjs | 密码哈希 |
| 前端状态 | Zustand + persist | 客户端状态管理 |
| 前端路由 | React Router v6 | SPA 路由 |

---

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    浏览器 (前端 SPA)                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │ Login   │  │ Register │  │ ForgotPassword       │    │
│  │  Page   │  │  Page    │  │  Page                │    │
│  └────┬────┘  └────┬─────┘  └──────────┬───────────┘    │
│       │            │                    │                 │
│  ┌────┴────────────┴────────────────────┴───────────┐    │
│  │              authStore (Zustand)                  │    │
│  │         persist → localStorage                   │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTP (Bearer Token)
┌─────────────────────────┼───────────────────────────────┐
│  Nginx (反向代理)        │                                │
│  location /api/ ────────┘                                │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           aimpad-api (Express:3001)               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │   │
│  │  │ /send-   │  │ /register│  │ /reset-       │   │   │
│  │  │  code    │  │ /login   │  │  password     │   │   │
│  │  │          │  │ /me      │  │               │   │   │
│  │  └────┬─────┘  └────┬─────┘  └───────┬───────┘   │   │
│  └───────┼──────────────┼────────────────┼───────────┘   │
│          │              │                │                │
│    ┌─────▼──────┐  ┌────▼────────────────▼───────────┐  │
│    │   Redis    │  │          MySQL 8.0               │  │
│    │ 验证码缓存  │  │  users / verification_codes      │  │
│    │ 冷却控制    │  │  user_settings                   │  │
│    └────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 认证流程

### 3.1 注册流程

```
用户输入邮箱 → 点击"发送验证码" → 后端生成验证码存入 Redis
    → 用户输入验证码 + 用户名 → 提交注册
    → 后端校验验证码 → 检查邮箱/用户名唯一性
    → 创建用户 + 默认设置 → 签发 JWT → 返回前端
```

### 3.2 登录流程

```
用户输入邮箱 → 点击"发送验证码" → 后端生成验证码存入 Redis
    → 用户输入验证码 → 提交登录
    → 后端校验验证码 → 查找用户 → 更新登录时间
    → 签发 JWT → 返回前端
```

### 3.3 密码找回流程

```
用户在登录页点击"忘记密码？" → 进入密码找回页
    → 输入邮箱 → 点击"发送验证码" (purpose=reset)
    → 输入验证码 + 新密码 + 确认密码 → 提交
    → 后端校验验证码 → 更新密码哈希 → 返回成功
    → 前端自动跳转到登录页
```

### 3.4 Token 验证流程

```
页面加载 → 从 localStorage 读取 JWT
    → 调用 GET /api/auth/me 验证 token 有效性
    → 有效：恢复用户状态 → 无效：清除本地状态
```

---

## 4. 后端 API 设计

所有端点挂载在 `/api/auth` 路径下。

### 4.1 发送验证码

**`POST /api/auth/send-code`**

| 项目 | 说明 |
|------|------|
| 认证 | 不需要 |
| Content-Type | application/json |

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| purpose | string | yes | 用途：`login` / `register` / `reset` |

**响应示例：**

```json
{ "success": true, "message": "验证码已发送" }
```

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 400 | 参数缺失或格式错误 |
| 429 | 发送过于频繁（60秒冷却） |

**内部逻辑：**
- 检查 Redis 冷却 key `cooldown:{email}`，防止频繁发送
- 生成验证码（演示模式固定为 `1234`）
- 存入 Redis：`verify:{email}:{purpose}`，TTL 300 秒
- 设置冷却：`cooldown:{email}`，TTL 60 秒
- 写入 MySQL `verification_codes` 表审计

---

### 4.2 用户注册

**`POST /api/auth/register`**

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| code | string | 是 | 验证码 |
| username | string | 是 | 用户名（3-32字符，字母数字下划线） |

**响应示例：**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "testuser",
    "nickname": null,
    "avatarUrl": null
  }
}
```

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 400 | 参数缺失或验证码错误 |
| 409 | 邮箱已注册或用户名已占用 |

**内部逻辑：**
- 校验 Redis 中的验证码 `verify:{email}:register`
- 检查邮箱和用户名唯一性
- 创建用户（`password_hash` 默认为空字符串）
- 创建默认 `user_settings` 记录
- 删除已使用的验证码
- 签发 JWT（payload: `{ id, email, username }`，有效期 7 天）

---

### 4.3 用户登录

**`POST /api/auth/login`**

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| code | string | 是 | 验证码 |

**响应示例：** 同注册接口

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 400 | 参数缺失或验证码错误 |
| 404 | 邮箱未注册 |

---

### 4.4 重置密码

**`POST /api/auth/reset-password`**

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| code | string | 是 | 验证码 |
| password | string | yes | 新密码（至少 6 位） |

**响应示例：**

```json
{ "success": true, "message": "密码重置成功" }
```

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 400 | 参数缺失、密码过短或验证码错误 |
| 404 | 邮箱未注册 |

**内部逻辑：**
- 校验 Redis 中的验证码 `verify:{email}:reset`
- 检查用户是否存在
- 使用 bcrypt 哈希新密码（salt rounds: 10）
- 更新 `users.password_hash`
- 删除已使用的验证码

---

### 4.5 获取当前用户信息

**`GET /api/auth/me`**

| 项目 | 说明 |
|------|------|
| 认证 | 需要 Bearer Token |

**响应示例：**

```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "user@example.com",
    "nickname": null,
    "avatarUrl": null,
    "createdAt": "2026-05-01T08:00:00.000Z"
  },
  "settings": { ... }
}
```

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 401 | 未提供令牌或令牌无效 |
| 404 | 用户不存在 |

---

### 4.6 健康检查

**`GET /api/health`**

**响应示例：**

```json
{ "status": "ok", "timestamp": "2026-05-01T08:00:00.000Z" }
```

---

## 5. 前端实现

### 5.1 页面组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `Login` | `/login` | 登录页：邮箱 + 验证码 + 登录按钮 + 忘记密码链接 |
| `Register` | `/register` | 注册页：邮箱 + 用户名 + 验证码 + 注册按钮 |
| `ForgotPassword` | `/forgot-password` | 密码找回页：邮箱 + 验证码 + 新密码 + 确认密码 |
| `UserMenu` | — | 用户头像下拉菜单（退出登录） |

**页面设计规范：**
- 使用 `Card` 组件（variant="elevated"）作为容器
- 居中卡片布局：`min-h-[calc(100vh-4rem)] flex items-center justify-center`
- 输入框样式：`bg-surface-700 border-surface-600 focus:border-accent`
- 验证码输入框旁有"发送验证码"按钮，带 60 秒倒计时
- 提示文字："演示模式，验证码为：1234"

### 5.2 状态管理

使用 Zustand + persist 中间件，存储 key 为 `aimpad-auth`。

**State 字段：**

| 字段 | 类型 | 持久化 | 说明 |
|------|------|--------|------|
| token | string \| null | 是 | JWT 令牌 |
| user | User \| null | 是 | 用户信息 |
| isAuthenticated | boolean | 是 | 是否已登录 |
| isLoading | boolean | 否 | 请求加载中 |
| error | string \| null | 否 | 错误信息 |

**Actions：**

| Action | 参数 | 说明 |
|--------|------|------|
| sendCode | email, purpose | 发送验证码 |
| register | email, code, username | 注册 |
| login | email, code | 登录 |
| resetPassword | email, code, password | 重置密码 |
| logout | — | 退出登录，清除状态 |
| fetchUser | — | 验证 token 并获取用户信息 |
| clearError | — | 清除错误信息 |

### 5.3 API 客户端

`src/api/client.ts` 封装了 fetch 请求：
- 自动从 localStorage 读取 JWT 并附加 `Authorization: Bearer {token}` 头
- 统一处理 JSON 响应和错误
- 基础路径：`/api`

### 5.4 类型定义

```typescript
interface User {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  createdAt?: string;
}

interface AuthResponse { token: string; user: User; }
interface SendCodeRequest { email: string; purpose: 'login' | 'register' | 'reset'; }
interface RegisterRequest { email: string; code: string; username: string; }
interface LoginRequest { email: string; code: string; }
interface ResetPasswordRequest { email: string; code: string; password: string; }
```

### 5.5 国际化

认证相关 locale key 共 31 个，均以 `auth.` 为前缀，支持中英文双语。

---

## 6. 数据存储

### 6.1 Redis 存储

| Key 模式 | 用途 | TTL |
|----------|------|-----|
| `verify:{email}:{purpose}` | 验证码 | 300 秒 |
| `cooldown:{email}` | 发送冷却 | 60 秒 |

### 6.2 MySQL 存储

**users 表（关键字段）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 主键 |
| username | VARCHAR(32) UNIQUE | 用户名 |
| email | VARCHAR(128) UNIQUE | 邮箱 |
| password_hash | VARCHAR(128) DEFAULT '' | 密码哈希（bcrypt） |
| nickname | VARCHAR(64) | 昵称 |
| avatar_url | VARCHAR(512) | 头像 URL |
| last_login_at | DATETIME | 最后登录时间 |

**verification_codes 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 主键 |
| email | VARCHAR(128) | 邮箱 |
| code | VARCHAR(8) | 验证码 |
| purpose | VARCHAR(16) | 用途：login/register/reset |
| expires_at | DATETIME | 过期时间 |
| used | TINYINT(1) DEFAULT 0 | 是否已使用 |

**user_settings 表：**
- 注册时自动创建默认设置记录

---

## 7. 安全设计

| 安全措施 | 实现方式 |
|----------|----------|
| 验证码防爆破 | 60 秒发送冷却 + 5 分钟过期 |
| 密码存储 | bcrypt 哈希（salt rounds: 10） |
| 会话管理 | JWT 无状态令牌，有效期 7 天 |
| 令牌传输 | HTTP Header `Authorization: Bearer {token}` |
| 验证码一次性 | 使用后立即从 Redis 删除并标记 MySQL 记录 |
| CORS | 仅允许指定来源 |

---

## 8. 部署配置

### 8.1 Docker Compose 服务

`aimpad-api` 服务配置：
- 镜像：`swr.cn-north-4.myhuaweicloud.com/aimpad/api:latest`
- 端口：3001（内部）
- 依赖：mysql（healthy）、redis（healthy）
- 环境变量：DB_HOST, DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET 等

### 8.2 Nginx 反向代理

```nginx
location /api/ {
    proxy_pass http://aimpad-api:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    client_max_body_size 1m;
}
```

### 8.3 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | API 端口 | 3001 |
| DB_HOST | MySQL 主机 | mysql |
| DB_PASSWORD | MySQL 密码 | — |
| REDIS_HOST | Redis 主机 | redis |
| REDIS_PASSWORD | Redis 密码 | — |
| JWT_SECRET | JWT 签名密钥 | — |
| JWT_EXPIRES_IN | JWT 有效期 | 7d |
| DEMO_CODE | 演示验证码 | 1234 |

---

## 9. 文件清单

### 后端文件

| 文件 | 说明 |
|------|------|
| `server/package.json` | 依赖配置 |
| `server/tsconfig.json` | TypeScript 配置 |
| `server/Dockerfile` | Docker 镜像构建 |
| `server/src/index.ts` | Express 入口 |
| `server/src/config.ts` | 环境变量配置 |
| `server/src/db.ts` | MySQL 连接池 |
| `server/src/redis.ts` | Redis 客户端 |
| `server/src/routes/auth.ts` | 认证路由（6 个端点） |
| `server/src/middleware/auth.ts` | JWT 验证中间件 |

### 前端文件

| 文件 | 说明 |
|------|------|
| `src/types/auth.ts` | 类型定义 |
| `src/api/client.ts` | fetch 封装 |
| `src/api/auth.ts` | 认证 API 函数 |
| `src/stores/authStore.ts` | Zustand 状态管理 |
| `src/pages/Login.tsx` | 登录页 |
| `src/pages/Register.tsx` | 注册页 |
| `src/pages/ForgotPassword.tsx` | 密码找回页 |
| `src/components/ui/UserMenu.tsx` | 用户菜单组件 |

### 数据库脚本

| 文件 | 说明 |
|------|------|
| `scripts/init-database.sql` | 完整建库脚本 |
| `scripts/add-auth-tables.sql` | 认证表增量脚本 |
