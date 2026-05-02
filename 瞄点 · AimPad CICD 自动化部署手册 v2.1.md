# 瞄点 · AimPad CI/CD 自动化部署手册 v2.1

## 目录

- [1. 概述](#1-概述)
- [2. 架构总览](#2-架构总览)
- [3. GitHub Actions 工作流](#3-github-actions-工作流)
  - [3.1 触发条件](#31-触发条件)
  - [3.2 Job 1：构建并推送镜像](#32-job-1构建并推送镜像)
  - [3.3 Job 2：更新 GitOps 仓库](#33-job-2更新-gitops-仓库)
  - [3.4 Job 3：SSH 远程触发部署](#34-job-3ssh-远程触发部署)
- [4. 服务器部署](#4-服务器部署)
  - [4.1 前置条件：创建专用部署用户](#41-前置条件创建专用部署用户)
  - [4.2 目录结构](#42-目录结构)
  - [4.3 Docker Compose 配置](#43-docker-compose-配置)
  - [4.4 ECS 部署自动化原理](#44-ecs-部署自动化原理)
  - [4.5 主机 Nginx SSL 配置](#45-主机-nginx-ssl-配置)
- [5. 部署流程](#5-部署流程)
  - [5.1 首次部署](#51-首次部署)
  - [5.2 日常更新](#52-日常更新)
  - [5.3 回滚](#53-回滚)
- [6. 故障排查](#6-故障排查)
- [7. 常用命令](#7-常用命令)

---

## 1. 概述

AimPad 采用 **GitHub Actions + 华为云 SWR + SSH 即时部署** 的 CI/CD 方案：

```
本地 git push → GitHub Actions 构建并推送镜像到华为云 SWR
    → 更新仓库中的镜像标签 → SSH 以 deploy 用户登录 ECS 执行 git pull + 重新部署
```

**更新在 Actions 完成推送后立即生效，无需轮询等待。**

### 1.1 关键组件

| 组件           | 说明                                           |
| -------------- | ---------------------------------------------- |
| GitHub Actions | CI/CD 工作流，构建 Docker 镜像并触发远程部署   |
| 华为云 SWR     | 镜像仓库（`swr.cn-north-4.myhuaweicloud.com`） |
| Watchtower     | **已移除**，改为事件驱动即时部署               |
| 专用部署用户   | 服务器上使用 `deploy` 用户执行部署，而非 root  |
| 主机 Nginx     | SSL 终结 + 反向代理                            |

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
│  │  5. SSH into ECS (as deploy) → git pull → redeploy │ │
│  └──────────────────┬───────────────────────────────┘ │
└────────────────────┼──────────────────────────────────┘
                     │ Push images             │ SSH trigger (deploy user)
                     ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                  华为云 SWR 镜像仓库                      │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/aimpad:xxx     │
│  swr.cn-north-4.myhuaweicloud.com/aimpad/api:xxx        │
└──────────────┬──────────────────────────────────────────┘
               │ docker compose pull (via SSH as deploy)
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

Job 2 完成后，Actions 使用 `appleboy/ssh-action` 以 **`deploy` 用户** SSH 连接到 ECS 服务器，立即执行以下操作：

```bash
cd /opt/aimpad
git pull origin main
docker compose pull
docker compose up -d --remove-orphans
```

> **说明**：由于使用非 root 的 `deploy` 用户，工作流脚本中已移除 `nginx -s reload`（若确实需要，请参考 4.1 节配置 sudo 权限）。

**所需 GitHub Secrets：**

| Secret 名称         | 说明                                         | 示例值                  |
| ------------------- | -------------------------------------------- | ----------------------- |
| `SSH_HOST`          | ECS 公网 IP                                  | `123.123.123.123`       |
| `SSH_USER`          | 专用部署用户（非 root）                      | `deploy`                |
| `SSH_PRIVATE_KEY`   | 对应用户公钥的私钥完整内容                   | `-----BEGIN OPENSSH...` |
| `SWR_USERNAME`      | 华为云 SWR 账号                              | `cn-north-4@xxx`        |
| `SWR_PASSWORD`      | 华为云 SWR 密码                              | 你的 SWR 密码           |
| `GITOPS_REPO_TOKEN` | 用于更新 GitOps 仓库的 Personal Access Token | `ghp_xxxxxxxxxxxx`      |

---

## 4. 服务器部署

### 4.1 前置条件：创建专用部署用户

为确保安全，CI/CD 使用专用的 `deploy` 用户而非 `root`。**首次部署前需在 ECS 上完成以下配置。**

#### 1) 创建 deploy 用户并生成 SSH 密钥

```bash
# 以 root 执行
useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
chown deploy:deploy /home/deploy/.ssh

# 生成专用密钥对（以 deploy 身份）
sudo -u deploy ssh-keygen -t ed25519 -C "github-actions-deploy" -f /home/deploy/.ssh/github_actions -N ""

# 将公钥加入 authorized_keys
cat /home/deploy/.ssh/github_actions.pub >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

#### 2) 将私钥上传为 GitHub Secret

```bash
# 查看私钥内容，完整复制
cat /home/deploy/.ssh/github_actions
```

将输出的全部内容（包括 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）存入仓库的 `SSH_PRIVATE_KEY` Secret。

#### 3) 授予 deploy 用户 Docker 权限

```bash
usermod -aG docker deploy
# 重新登录 deploy 使组生效（或重启服务器）
```

#### 4) 授权 deploy 用户管理 /opt/aimpad 目录

```bash
chown -R deploy:deploy /opt/aimpad
```

#### 5) 让 deploy 用户登录华为云 SWR（拉取镜像需要）

```bash
# 切换到 deploy 用户
su - deploy
docker login -u <华为云账号> -p <SWR密码> swr.cn-north-4.myhuaweicloud.com
exit
```

此后 `deploy` 用户即可执行 `docker compose pull` 从私有仓库拉取镜像。

#### 6) （可选）允许 deploy 无密码重载主机 Nginx

如果部署脚本仍需重载主机 Nginx，可配置 sudo 免密码：

```bash
echo "deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -s reload" >> /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
```

然后将工作流中的命令改为 `sudo nginx -s reload || true`，或手动在文档中说明。

### 4.2 目录结构

```
/opt/aimpad/                     （属主：deploy:deploy）
├── docker-compose.yml           # 主配置（git 管理，标签被 Actions 自动更新）
├── docker-compose.override.yml  # 服务器特定配置（不在 git 中）
├── .env                         # 环境变量（密码等）
├── config/
│   ├── mysql/
│   │   └── custom.cnf
│   └── redis/
│       └── redis.conf
├── scripts/
│   ├── init-database.sql
│   └── add-auth-tables.sql
└── data/                        # 数据卷（自动创建）
```

### 4.3 Docker Compose 配置

**docker-compose.yml（git 管理，由 Actions 自动维护镜像标签）：**

| 服务       | 镜像                  | 端口           | 依赖                     |
| ---------- | --------------------- | -------------- | ------------------------ |
| aimpad     | aimpad/aimpad:`{tag}` | 80:80          | mysql, redis, aimpad-api |
| aimpad-api | aimpad/api:`{tag}`    | 3001           | mysql, redis             |
| mysql      | mysql:8.0             | 127.0.0.1:3306 | —                        |
| redis      | redis:7-alpine        | 127.0.0.1:6379 | —                        |

**docker-compose.override.yml（服务器特定，不纳入 git，无 watchtower）：**

```yaml
services:
  aimpad:
    ports:
      - "8080:80"
```

### 4.4 ECS 部署自动化原理

1. 代码推送 → Actions 工作流启动。
2. 构建镜像 → 推送至华为云 SWR。
3. 更新 GitOps 标签 → `docker-compose.yml` 中的镜像标签改为新 commit SHA。
4. SSH 触发（以 `deploy` 用户）：
   - `git pull` 拉取包含新标签的配置。
   - `docker compose pull` 拉取指定标签镜像。
   - `docker compose up -d` 以新镜像重建容器。
5. 回滚时只需将 `docker-compose.yml` 中标签改回历史版本并重新部署。

### 4.5 主机 Nginx SSL 配置

配置文件：`/etc/nginx/conf.d/aimpad.online.conf`

```nginx
server {
    listen 80;
    server_name aimpad.online;
    return 301 https://$host$request_uri;
}

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

---

## 5. 部署流程

### 5.1 首次部署

**请先完成 [4.1 前置条件：创建专用部署用户](#41-前置条件创建专用部署用户)。** 然后执行以下步骤：

```bash
# 以下操作以 root 执行（最后会授权给 deploy）
cd /opt
git clone https://github.com/jiangdongshi/AimPad.git aimpad
cd aimpad

# 创建 .env（密码自行设置）
cat > .env << 'EOF'
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_PASSWORD=your_db_password
REDIS_PASSWORD=your_redis_password
JWT_SECRET=your_jwt_secret_at_least_32_chars
EOF

# 创建服务器特定配置（无 watchtower）
cat > docker-compose.override.yml << 'EOF'
services:
  aimpad:
    ports:
      - "8080:80"
EOF

# 修改目录属主为 deploy
chown -R deploy:deploy /opt/aimpad

# 启动所有服务
docker compose up -d

# 初始化数据库
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/init-database.sql
docker exec -i mysql mysql -uroot -p'your_root_password' aimpad < scripts/add-auth-tables.sql

# 配置主机 Nginx SSL（参考 4.5 节）
# 启动主机 Nginx
systemctl start nginx
systemctl enable nginx

# 确保 deploy 用户已登录 SWR（如果尚未执行）
su - deploy -c "docker login -u <华为云账号> -p <SWR密码> swr.cn-north-4.myhuaweicloud.com"
```

### 5.2 日常更新

- **自动部署（推荐）**：推送代码到 `main` 分支，Actions 完成构建后将立即通过 SSH 以 `deploy` 用户完成部署，无需人工干预。
- **手动部署（备用）**：
  ```bash
  cd /opt/aimpad
  git pull
  docker compose pull
  docker compose up -d
  # 如果需要重载主机 Nginx：
  sudo nginx -s reload
  ```

### 5.3 回滚

```bash
cd /opt/aimpad
# 编辑 docker-compose.yml，将 aimpad 和 aimpad-api 的 tag 改为旧 version SHA
git add docker-compose.yml
git commit -m "rollback to previous version"
git push
# 随后 Actions 自动部署；或手动执行 git pull && docker compose up -d
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
```

### 6.3 Redis 密码错误
```bash
docker exec redis redis-cli -a 'your_password' ping
grep REDIS_PASSWORD /opt/aimpad/.env
grep requirepass /opt/aimpad/config/redis/redis.conf
```

### 6.4 nginx DNS 缓存
```bash
docker compose restart aimpad
# 或重载主机 Nginx（需要 sudo 权限）
sudo nginx -s reload
```

### 6.5 SSL 证书问题
```bash
curl -sk https://localhost/ -o /dev/null -w "%{http_code}"
ls -la /etc/nginx/ssl/aimpad.online_nginx/
nginx -t && sudo nginx -s reload
```

### 6.6 SSH 部署失败
- 检查 Actions 日志中 `Deploy to ECS via SSH` 的输出。
- 确认 `SSH_USER` Secrets 为 `deploy`。
- 用以下命令在 ECS 上模拟验证：
  ```bash
  ssh -i /home/deploy/.ssh/github_actions deploy@localhost "whoami && docker ps"
  ```
- 检查 `/opt/aimpad` 权限：`ls -la /opt/aimpad`，应属 `deploy:deploy`。
- 确保 `deploy` 已在 `docker` 组中（`groups deploy`）。

### 6.7 镜像拉取鉴权失败
确认 `deploy` 用户已独立登录 SWR：
```bash
su - deploy -c "docker login swr.cn-north-4.myhuaweicloud.com"
```
（登录凭据保存在 `/home/deploy/.docker/config.json`）

---

## 7. 常用命令

```bash
# 查看所有容器状态
docker ps -a

# 查看容器日志
docker logs aimpad-api --tail 50 -f

# 重启单个服务
docker compose restart aimpad-api

# 重新创建容器（环境变量变更时）
docker compose up -d aimpad-api

# 手动拉取新镜像并重建
docker compose pull aimpad aimpad-api
docker compose up -d

# 查看容器 nginx 错误日志
docker exec aimpad cat /var/log/nginx/error.log | tail -20

# 模拟一次完整部署（需在 /opt/aimpad 下以 deploy 执行）
cd /opt/aimpad && git pull && docker compose pull && docker compose up -d

# Watchtower 相关命令已全部移除
```

---

**文档版本：v2.1 — 适配 deploy 用户的 SSH 即时部署方案**  
所有操作均已从 root 移至专用 `deploy` 用户，提升生产安全性。