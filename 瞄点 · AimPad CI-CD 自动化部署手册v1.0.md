# 瞄点 · AimPad CI/CD 自动化部署手册

## 目录

- [1. 概述](#1-概述)
- [2. 架构总览](#2-架构总览)
- [3. GitHub Actions 工作流](#3-github-actions-工作流)
  - [3.1 触发条件](#31-触发条件)
  - [3.2 Job 1：构建并推送镜像](#32-job-1构建并推送镜像)
  - [3.3 Job 2：更新 GitOps 仓库](#33-job-2更新-gitops-仓库)
- [4. 服务器部署](#4-服务器部署)
  - [4.1 目录结构](#41-目录结构)
  - [4.2 Docker Compose 配置](#42-docker-compose-配置)
  - [4.3 Watchtower 自动更新](#43-watchtower-自动更新)
  - [4.4 主机 Nginx SSL 配置](#44-主机-nginx-ssl-配置)
- [5. 部署流程](#5-部署流程)
- [6. 故障排查](#6-故障排查)
- [7. 常用命令](#7-常用命令)

---

## 1. 概述

AimPad 采用 GitHub Actions + 华为云 SWR + Watchtower 的 CI/CD 方案：

```
本地 git push → GitHub Actions 构建镜像 → 推送到华为云 SWR
    → Watchtower 检测到镜像更新 → 自动拉取并重启容器
```

### 1.1 关键组件

| 组件 | 说明 |
|------|------|
| GitHub Actions | CI/CD 工作流，构建 Docker 镜像 |
| 华为云 SWR | 镜像仓库（`swr.cn-north-4.myhuaweicloud.com`） |
| Watchtower | Docker 容器自动更新工具 |
| 主机 Nginx | SSL 终结 + 反向代理 |

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              GitHub Actions                          │    │
│  │  1. Checkout code                                    │    │
│  │  2. Build frontend Docker image (aimpad/aimpad)      │    │
│  │  3. Build API Docker image (aimpad/api)              │    │
│  │  4. Push both images to Huawei Cloud SWR             │    │
│  │  5. Update docker-compose.yml image tags             │    │
│  └──────────────────────────┬──────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────┘
                              │ Push images
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  华为云 SWR 镜像仓库                          │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/aimpad:latest      │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/api:latest         │
└─────────────────────────────┬───────────────────────────────┘
                              │ Pull images (every 5 min)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     ECS 服务器                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 主机 Nginx   │  │  Watchtower  │  │  Docker Compose  │   │
│  │ SSL + 反代   │  │  自动更新     │  │  容器编排         │   │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘   │
│         │                                                    │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │  :8080 → aimpad (Nginx 前端)                        │    │
│  │  :3001 → aimpad-api (Express API)                   │    │
│  │  :3306 → mysql (MySQL 8.0)                          │    │
│  │  :6379 → redis (Redis 7)                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

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
2. 登录华为云 SWR
3. 设置 Docker Buildx（支持构建缓存）
4. 提取元数据（镜像 tag：commit SHA + latest）
5. 构建并推送前端镜像 `aimpad/aimpad`
6. 构建并推送 API 镜像 `aimpad/api`

**镜像 Tag 策略：**
- `{commit_sha}` — 如 `b2e701f`
- `latest` — 始终指向最新版本

**构建缓存：**
- 使用 GitHub Actions Cache (`type=gha`)
- 前端和 API 独立缓存（scope=frontend / scope=api）

### 3.3 Job 2：更新 GitOps 仓库

构建完成后，自动更新 `docker-compose.yml` 中的镜像 tag 为新的 commit SHA，提交并推送到 main 分支。

---

## 4. 服务器部署

### 4.1 目录结构

```
/opt/aimpad/
├── docker-compose.yml              # 主配置（git 管理）
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

**docker-compose.yml（git 管理）：**

| 服务 | 镜像 | 端口 | 依赖 |
|------|------|------|------|
| aimpad | aimpad/aimpad:latest | 80:80 | mysql, redis, aimpad-api |
| aimpad-api | aimpad/api:latest | 3001 | mysql, redis |
| mysql | mysql:8.0 | 127.0.0.1:3306 | — |
| redis | redis:7-alpine | 127.0.0.1:6379 | — |

**docker-compose.override.yml（服务器特定）：**

```yaml
services:
  aimpad:
    ports:
      - "8080:80"   # 主机 nginx 反代到 8080

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      TZ: Asia/Shanghai
    command: --interval 300 --cleanup aimpad aimpad-api
```

**为什么需要 override 文件？**
- `docker-compose.yml` 中端口为 `80:80`（标准配置）
- 服务器上主机 nginx 占用 80/443 端口，容器需映射到 8080
- override 文件不在 git 中，不会被 CI/CD 覆盖

### 4.3 Watchtower 自动更新

| 配置 | 值 | 说明 |
|------|------|------|
| 检查间隔 | 300 秒（5 分钟） | 每 5 分钟检查镜像更新 |
| 监控容器 | aimpad, aimpad-api | 只监控前端和 API 容器 |
| 自动清理 | --cleanup | 拉取新镜像后清理旧镜像 |
| 时区 | Asia/Shanghai | 日志时间 |

**工作原理：**
1. Watchtower 每 5 分钟检查 SWR 上的镜像 digest
2. 如果发现新版本，自动 `docker pull` 新镜像
3. 使用新镜像重新创建容器（保留原有配置）
4. 清理旧镜像释放磁盘空间

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
        proxy_pass http://127.0.0.1:8080;  # 转发到容器 nginx
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

**请求链路：**

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

# 3. 创建服务器特定配置
cat > docker-compose.override.yml << 'EOF'
services:
  aimpad:
    ports:
      - "8080:80"
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      TZ: Asia/Shanghai
    command: --interval 300 --cleanup aimpad aimpad-api
EOF

# 4. 启动服务
docker compose up -d

# 5. 初始化数据库
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/init-database.sql
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/add-auth-tables.sql

# 6. 配置主机 Nginx SSL（参考 4.4 节）
# 7. 启动主机 Nginx
systemctl start nginx
systemctl enable nginx
```

### 5.2 日常更新

```bash
# 方式一：自动（推荐）
# git push 后，Watchtower 会在 5 分钟内自动检测并更新

# 方式二：手动
cd /opt/aimpad
git pull
docker compose pull
docker compose up -d
nginx -s reload  # 如果 nginx 配置有变化
```

### 5.3 回滚

```bash
# 查看可用镜像版本
docker images | grep aimpad

# 修改 docker-compose.yml 中的 tag 为旧版本
# 然后重新部署
docker compose up -d
```

---

## 6. 故障排查

### 6.1 容器无法启动

```bash
# 查看容器状态和日志
docker compose ps
docker logs aimpad --tail 20
docker logs aimpad-api --tail 20
```

### 6.2 端口冲突

```bash
# 查看端口占用
ss -tlnp | grep -E ':(80|443|8080|3306|6379) '

# 常见冲突：
# - 主机 nginx 和容器 nginx 都监听 80 → 使用 override 改为 8080
# - 防火墙阻止端口 → 关闭 firewalld 或放行端口
```

### 6.3 Redis 密码错误

```bash
# 验证 Redis 密码
docker exec redis redis-cli -a 'your_password' ping

# 确保 .env 和 config/redis/redis.conf 密码一致
grep REDIS_PASSWORD /opt/aimpad/.env
grep requirepass /opt/aimpad/config/redis/redis.conf
```

### 6.4 nginx DNS 缓存

容器重建后 IP 变化，nginx 可能缓存旧 IP：

```bash
# 重启 nginx 容器刷新 DNS
docker compose restart aimpad

# 或重新加载主机 nginx
nginx -s reload
```

### 6.5 SSL 证书问题

```bash
# 测试 SSL
curl -sk https://localhost/ -o /dev/null -w "%{http_code}"

# 检查证书文件
ls -la /etc/nginx/ssl/aimpad.online_nginx/

# 重新加载 nginx
nginx -t && nginx -s reload
```

---

## 7. 常用命令

```bash
# 查看所有容器状态
docker ps -a

# 查看容器日志
docker logs aimpad-api --tail 50 -f

# 重启单个服务
docker compose restart aimpad-api

# 重新创建容器（读取新环境变量）
docker compose up -d aimpad-api

# 查看 Watchtower 日志
docker logs watchtower --tail 20

# 手动触发 Watchtower 检查
docker exec watchtower /watchtower --run-once

# 进入容器调试
docker exec -it aimpad sh
docker exec -it aimpad-api sh

# 查看 nginx 错误日志
docker exec aimpad cat /var/log/nginx/error.log | tail -20
```
