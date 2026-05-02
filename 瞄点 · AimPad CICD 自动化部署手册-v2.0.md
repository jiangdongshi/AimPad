# 瞄点 · AimPad CI/CD 自动化部署手册-v2.0

当前的 CI/CD 方案更新为 **GitHub Actions + 华为云 SWR + SSH 即时部署**，完全替代了原有的 Watchtower 轮询机制。文档已按新架构重写，以下是修改后的《瞄点 · AimPad CI/CD 自动化部署手册》全文。

## 目录

- [1. 概述](#1-概述)
- [2. 架构总览](#2-架构总览)
- [3. GitHub Actions 工作流](#3-github-actions-工作流)
  - [3.1 触发条件](#31-触发条件)
  - [3.2 Job 1：构建并推送镜像](#32-job-1构建并推送镜像)
  - [3.3 Job 2：更新 GitOps 仓库](#33-job-2更新-gitops-仓库)
  - [3.4 Job 3：SSH 远程触发部署](#34-job-3ssh-远程触发部署)
- [4. 服务器部署](#4-服务器部署)
  - [4.1 目录结构](#41-目录结构)
  - [4.2 Docker Compose 配置](#42-docker-compose-配置)
  - [4.3 ECS 部署自动化原理](#43-ecs-部署自动化原理)
  - [4.4 主机 Nginx SSL 配置](#44-主机-nginx-ssl-配置)
- [5. 部署流程](#5-部署流程)
- [6. 故障排查](#6-故障排查)
- [7. 常用命令](#7-常用命令)

---

## 1. 概述

AimPad 采用 **GitHub Actions + 华为云 SWR + SSH 即时部署** 的 CI/CD 方案：

```
本地 git push → GitHub Actions 构建并推送镜像到华为云 SWR
    → 更新仓库中的镜像标签 → SSH 到 ECS 执行 git pull + 重新部署
```

**更新在 Actions 完成推送后立即生效，无需轮询等待。**

### 1.1 关键组件

| 组件                      | 说明                                           |
| ------------------------- | ---------------------------------------------- |
| GitHub Actions            | CI/CD 工作流，构建 Docker 镜像并触发远程部署   |
| 华为云 SWR                | 镜像仓库（`swr.cn-north-4.myhuaweicloud.com`） |
| GitHub Self-hosted Runner | **不再需要**，部署完全由 Actions 通过 SSH 驱动 |
| Watchtower                | **已移除**，改为事件驱动即时部署               |
| 主机 Nginx                | SSL 终结 + 反向代理                            |

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                        GitHub                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │              GitHub Actions                        │ │
│  │  1. Checkout code                                  │ │
│  │  2. Build frontend + API Docker images             │ │
│  │  3. Push images to Huawei Cloud SWR                │ │
│  │  4. Update docker-compose.yml image tags           │ │
│  │  5. SSH into ECS → git pull → redeploy             │ │
│  └──────────────────┬───────────────────────────────┘ │
└────────────────────┼──────────────────────────────────┘
                     │ Push images             │ SSH trigger
                     ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                  华为云 SWR 镜像仓库                      │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/aimpad:xxx     │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/api:xxx        │
└──────────────┬──────────────────────────────────────────┘
               │ docker compose pull (via SSH)
               ▼
┌─────────────────────────────────────────────────────────┐
│                     ECS 服务器                           │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ 主机 Nginx   │  │  Docker Compose                   │ │
│  │ SSL + 反代   │  │  ┌───────┐ ┌───────┐ ┌───────┐  │ │
│  └──────┬───────┘  │  │aimpad │ │api    │ │mysql  │  │ │
│         │          │  │:8080  │ │:3001  │ │:3306  │  │ │
│         └──────────┤  └───────┘ └───────┘ └───────┘  │ │
│                    │  ┌───────┐                       │ │
│                    │  │redis  │                       │ │
│                    │  │:6379  │                       │ │
│                    │  └───────┘                       │ │
│                    └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

请求链路不变：  
`浏览器 → HTTPS:443 → 主机 Nginx → HTTP:8080 (容器 aimpad) → HTTP:3001 (aimpad-api)`

---

## 3. GitHub Actions 工作流

配置文件：`.github/workflows/deploy.yml`

### 3.1 触发条件

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:  # 支持手动触发
```

### 3.2 Job 1：构建并推送镜像

**步骤：**

1. Checkout 代码
2. 登录华为云 SWR（使用 Secrets 中的 `SWR_USERNAME`、`SWR_PASSWORD`）
3. 设置 Docker Buildx（利用 GitHub Actions 缓存加速构建）
4. 提取元数据（镜像 tag：commit SHA + `latest`）
5. 构建并推送前端镜像 `aimpad/aimpad`
6. 构建并推送 API 镜像 `aimpad/api`

**镜像 Tag 策略：**
- `{commit_sha}` — 如 `b2e701f`
- `latest` — 始终指向最新版本

**构建缓存：**
- 使用 GitHub Actions Cache (`type=gha`)
- 前端和 API 独立缓存（scope=frontend / scope=api）

### 3.3 Job 2：更新 GitOps 仓库

构建完成后，自动将 `docker-compose.yml` 中的镜像 tag 更新为本次构建的 commit SHA，提交并推送回 main 分支。该步骤确保了仓库内始终记录着当前部署的精确版本，便于回滚和审计。

### 3.4 Job 3：SSH 远程触发部署

**这是替代 Watchtower 的关键步骤。**  

Job 2 完成后，Actions 使用 `appleboy/ssh-action` 通过 SSH 连接到 ECS 服务器，立即执行以下操作：

```bash
cd /opt/aimpad
git pull origin main
docker compose pull
docker compose up -d --remove-orphans
nginx -s reload || true   # 若 Nginx 配置有变动则重载
```

**前置要求：**

- ECS 上已生成专用 SSH 密钥对，公钥加入 `authorized_keys`，私钥内容保存在 GitHub Secrets 的 `SSH_PRIVATE_KEY` 中。
- ECS 已预先 `docker login` 到华为云 SWR（仅需首次执行一次）。
- 服务器上 `/opt/aimpad` 是 Git 仓库，且可由 Actions 通过 SSH 拉取更新。

Secrets 设置：

| Secret 名称         | 说明                                         |
| ------------------- | -------------------------------------------- |
| `SSH_HOST`          | ECS 公网 IP                                  |
| `SSH_USER`          | SSH 登录用户（如 `root`）                    |
| `SSH_PRIVATE_KEY`   | 对应公钥的私钥完整内容                       |
| `SWR_USERNAME`      | 华为云 SWR 账号                              |
| `SWR_PASSWORD`      | 华为云 SWR 密码                              |
| `GITOPS_REPO_TOKEN` | 用于更新 GitOps 仓库的 Personal Access Token |

---

## 4. 服务器部署

### 4.1 目录结构

```
/opt/aimpad/
├── docker-compose.yml              # 主配置（git 管理，镜像标签被 Actions 自动更新）
├── docker-compose.override.yml     # 服务器特定配置（不在 git 中）
├── .env                            # 环境变量（密码等）
├── config/
│   ├── mysql/
│   │   └── custom.cnf              # MySQL 自定义配置
│   └── redis/
│       └── redis.conf              # Redis 配置
├── scripts/
│   ├── init-database.sql           # 数据库初始化脚本
│   └── add-auth-tables.sql         # 认证表增量脚本
└── data/                           # 数据卷（自动创建）
```

### 4.2 Docker Compose 配置

**docker-compose.yml（git 管理，由 Actions 自动维护镜像标签）：**

| 服务       | 镜像                  | 端口           | 依赖                     |
| ---------- | --------------------- | -------------- | ------------------------ |
| aimpad     | aimpad/aimpad:`{tag}` | 80:80          | mysql, redis, aimpad-api |
| aimpad-api | aimpad/api:`{tag}`    | 3001           | mysql, redis             |
| mysql      | mysql:8.0             | 127.0.0.1:3306 | —                        |
| redis      | redis:7-alpine        | 127.0.0.1:6379 | —                        |

> 镜像标签在每次部署时会被 Job 2 更新为类似 `b2e701f` 的 commit SHA，而非固定 `latest`。这样可以精确定位版本，方便回滚。

**docker-compose.override.yml（服务器特定配置，不纳入 git）：**

Watchtower 已被移除，现在 override 文件仅用于端口映射调整和任何本地开发所需的服务。

```yaml
services:
  aimpad:
    ports:
      - "8080:80"   # 主机 nginx 反代到 8080

  # 不再需要 watchtower 服务
```

**为什么需要 override 文件？**
- `docker-compose.yml` 中端口定义为 `80:80`（标准值）。
- 生产服务器上主机 nginx 已占用 80/443，因此容器必须映射到 8080。
- override 文件独立于仓库，不会被 CI/CD 更新覆盖。

### 4.3 ECS 部署自动化原理

1. **代码推送** → Actions 工作流启动。
2. **构建镜像** → 推送至华为云 SWR。
3. **更新 GitOps 标签** → `docker-compose.yml` 中的镜像标签被改为新 commit SHA。
4. **SSH 触发** → Actions 通过 SSH 执行预定义部署脚本：
   - `git pull` 拉取包含新标签的 docker-compose.yml。
   - `docker compose pull` 拉取指定标签的最新镜像。
   - `docker compose up -d` 以新镜像重建容器，自动保持原有配置、网络、数据卷。
   - 镜像标签锁定 → 回滚时只需将 `docker-compose.yml` 中标签改为历史版本并重新部署。

**之前使用的 Watchtower 容器已被移除，无需在服务器上运行轮询服务，更新完全由 CI 事件驱动。**

### 4.4 主机 Nginx SSL 配置

配置文件：`/etc/nginx/conf.d/aimpad.online.conf`

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name aimpad.online;
    return 301 https://$host$request_uri;
}

# HTTPS 反向代理
server {
    listen 443 ssl http2;
    server_name aimpad.online;

    ssl_certificate     /etc/nginx/ssl/aimpad.online_nginx/aimpad.online_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/aimpad.online_nginx/aimpad.online.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

**请求链路不变：**

```
浏览器 → HTTPS:443 → 主机 Nginx (SSL 终结)
    → HTTP:8080 → 容器 Nginx (aimpad)
    → HTTP:3001 → 容器 Express (aimpad-api)
```

---

## 5. 部署流程

### 5.1 首次部署

```bash
# 1. 克隆仓库
cd /opt
git clone https://github.com/jiangdongshi/AimPad.git aimpad
cd aimpad

# 2. 创建环境变量文件
cat > .env << 'EOF'
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_PASSWORD=your_db_password
REDIS_PASSWORD=your_redis_password
JWT_SECRET=your_jwt_secret_at_least_32_chars
EOF

# 3. 创建服务器特定配置（仅端口映射，无 watchtower）
cat > docker-compose.override.yml << 'EOF'
services:
  aimpad:
    ports:
      - "8080:80"
EOF

# 4. 启动所有服务
docker compose up -d

# 5. 初始化数据库
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/init-database.sql
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/add-auth-tables.sql

# 6. 配置主机 Nginx SSL（参考 4.4 节）
# 7. 启动主机 Nginx
systemctl start nginx
systemctl enable nginx

# 8. 登录华为云 SWR（使服务器能拉取私有镜像）
docker login -u <华为云账号> -p <SWR密码> swr.cn-north-4.myhuaweicloud.com
```

### 5.2 日常更新

**自动部署（推荐）：**  
推送代码到 `main` 分支，GitHub Actions 完成构建并推送镜像后，会立刻 SSH 到 ECS 执行部署。无需任何手动操作，更新在 Actions 成功结束后即生效。

**手动部署（备用）：**
```bash
cd /opt/aimpad
git pull
docker compose pull
docker compose up -d
nginx -s reload   # 只有当 nginx 配置变动时才需要
```

### 5.3 回滚

因为镜像标签已锁定为 commit SHA，只需回滚 `docker-compose.yml` 中的标签，然后重新部署。

```bash
# 在本地或服务器上：
cd /opt/aimpad
# 编辑 docker-compose.yml，将 aimpad 和 aimpad-api 的 tag 改为旧版本 SHA
git add docker-compose.yml
git commit -m "rollback to previous version"
git push

# 随后 Actions 会自动触发部署；或手动执行一次 git pull && docker compose up -d
```

---

## 6. 故障排查

### 6.1 容器无法启动

```bash
docker compose ps
docker logs aimpad --tail 20
docker logs aimpad-api --tail 20
```

### 6.2 端口冲突

```bash
ss -tlnp | grep -E ':(80|443|8080|3306|6379) '
# 确保主机 Nginx 只占用 80/443，容器映射到 8080
```

### 6.3 Redis 密码错误

```bash
docker exec redis redis-cli -a 'your_password' ping
grep REDIS_PASSWORD /opt/aimpad/.env
grep requirepass /opt/aimpad/config/redis/redis.conf
```

### 6.4 nginx DNS 缓存

容器重建后 IP 变化，可重启容器 nginx：

```bash
docker compose restart aimpad
# 或重载主机 nginx
nginx -s reload
```

### 6.5 SSL 证书问题

```bash
curl -sk https://localhost/ -o /dev/null -w "%{http_code}"
ls -la /etc/nginx/ssl/aimpad.online_nginx/
nginx -t && nginx -s reload
```

### 6.6 SSH 部署失败

- 检查 Actions 日志中 `Deploy to ECS via SSH` 步骤的输出。
- 在 ECS 上确认 SSH 密钥对正确：
  ```bash
  cat ~/.ssh/authorized_keys
  ```
- 确保 GitHub Secrets 中 `SSH_PRIVATE_KEY` 与公钥匹配，且格式完整（包含 `-----BEGIN OPENSSH PRIVATE KEY-----` 头部）。
- 检查 `/opt/aimpad` 目录权限及 git 远程可拉取（若使用 HTTPS 需配置 credentials）。

### 6.7 镜像拉取鉴权失败

确认 ECS 已登录华为云 SWR：

```bash
docker login swr.cn-north-4.myhuaweicloud.com
```

守护进程重启后可能需要重新登录，可将登录命令加入启动脚本。

---

## 7. 常用命令

```bash
# 查看所有容器状态
docker ps -a

# 查看容器日志
docker logs aimpad-api --tail 50 -f

# 重启单个服务
docker compose restart aimpad-api

# 重新创建容器（当环境变量变更时）
docker compose up -d aimpad-api

# 手动拉取最新镜像并重建
docker compose pull aimpad aimpad-api
docker compose up -d

# 查看 nginx 错误日志（容器内）
docker exec aimpad cat /var/log/nginx/error.log | tail -20

# 立即测试一次完整部署（在服务器上模拟 SSH 触发效果）
cd /opt/aimpad && git pull && docker compose pull && docker compose up -d

# 此时不再需要 Watchtower 相关命令
```

---

**文档版本：v2.0 — 基于 SSH 的即时部署方案**  
旧的基于 Watchtower 的流程已被替代，详见更新历史。