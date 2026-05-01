# 瞄点 · AimPad 项目运行环境部署手册

## 目录

- [1. 方案概述](#1-方案概述)
- [2. 技术选型](#2-技术选型)
- [3. 架构设计](#3-架构设计)
- [4. 服务器基础环境配置](#4-服务器基础环境配置)
  - [4.1 系统初始化](#41-系统初始化)
  - [4.2 Docker 安装与配置](#42-docker-安装与配置)
  - [4.3 Docker Compose 安装](#43-docker-compose-安装)
- [5. Nginx 安装与配置](#5-nginx-安装与配置)
  - [5.1 Docker 容器内 Nginx（当前方案）](#51-docker-容器内-nginx当前方案)
  - [5.2 宿主机 Nginx 反向代理（扩展方案）](#52-宿主机-nginx-反向代理扩展方案)
- [6. MySQL 安装与配置](#6-mysql-安装与配置)
  - [6.1 Docker 方式部署 MySQL](#61-docker-方式部署-mysql)
  - [6.2 宿主机方式安装 MySQL](#62-宿主机方式安装-mysql)
  - [6.3 MySQL 基础配置与安全加固](#63-mysql-基础配置与安全加固)
  - [6.4 MySQL 备份与恢复](#64-mysql-备份与恢复)
- [7. Redis 安装与配置](#7-redis-安装与配置)
  - [7.1 Docker 方式部署 Redis](#71-docker-方式部署-redis)
  - [7.2 宿主机方式安装 Redis](#72-宿主机方式安装-redis)
  - [7.3 Redis 基础配置与安全加固](#73-redis-基础配置与安全加固)
- [8. 完整 Docker Compose 编排](#8-完整-docker-compose-编排)
- [9. Docker 镜像构建](#9-docker-镜像构建)
- [10. GitHub Actions CI/CD 工作流](#10-github-actions-cicd-工作流)
- [11. GitHub Secrets 配置](#11-github-secrets-配置)
- [12. 日常部署流程](#12-日常部署流程)
- [13. 手动部署与回滚](#13-手动部署与回滚)
- [14. 监控与日志](#14-监控与日志)
- [15. 故障排查](#15-故障排查)
- [16. 安全加固](#16-安全加固)
- [附录 A：资源占用估算](#附录-a资源占用估算)
- [附录 B：常用端口清单](#附录-b常用端口清单)
- [附录 C：后续扩展方向](#附录-c后续扩展方向)

---

## 1. 方案概述

### 1.1 背景

AimPad 是纯前端项目（Vite + React + Babylon.js），构建产物为 `dist/` 静态文件。需要将项目部署到 4C4G 60G ECS 云服务器，并实现自动化 CI/CD 流水线。后续可能扩展后端 API、数据库、缓存等服务。

### 1.2 目标

```
本地修改代码 → git push → 自动构建 → 自动部署到服务器 → 用户访问新版本
```

### 1.3 服务器配置

| 项目 | 配置 |
|------|------|
| CPU | 4 核 |
| 内存 | 4 GB |
| 存储 | 60 GB |
| 操作系统 | Linux（当前 CentOS 7.6.1810 / 亦兼容 Ubuntu 22.04 LTS / Debian 12） |

### 1.4 软件清单

| 软件 | 版本 | 用途 | 部署方式 |
|------|------|------|----------|
| Docker | 最新稳定版 | 容器运行时 | 宿主机安装 |
| Docker Compose | v2.x | 容器编排 | Docker 插件 |
| Nginx | alpine | 静态文件服务 / 反向代理 | Docker 容器 |
| MySQL | 8.0 | 关系型数据库（扩展用） | Docker 容器 |
| Redis | 7.x | 缓存 / 会话存储（扩展用） | Docker 容器 |

---

## 2. 技术选型

### 2.1 容器运行时：Nginx（非 Node.js）

| 方案 | 镜像体积 | 内存占用 | 适用场景 |
|------|----------|----------|----------|
| **Nginx:alpine（选用）** | **~25 MB** | **~5 MB** | **纯静态文件服务** |
| Node.js + Express | ~180 MB | ~80 MB | 需要 SSR/API |
| Caddy | ~40 MB | ~10 MB | 自动 HTTPS（备选） |

**选型理由**：AimPad 是纯前端 SPA，构建产物为静态文件，Nginx 是最成熟、最轻量的方案。4C4G 服务器运行 Nginx 几乎零资源消耗，剩余资源可留给后续扩展（如后端 API、数据库）。

### 2.2 镜像仓库：GHCR（GitHub Container Registry）

| 方案 | 免费额度 | 与 GitHub 集成 | 认证方式 |
|------|----------|----------------|----------|
| **GHCR（选用）** | **公共仓库无限** | **原生集成** | **GITHUB_TOKEN 自动** |
| Docker Hub | 1 个私有仓库 | 需额外配置 | 用户名 + Token |
| 阿里云 ACR | 有限免费 | 需额外配置 | 子账号密钥 |

**选型理由**：GHCR 与 GitHub Actions 原生集成，使用自动提供的 `GITHUB_TOKEN` 即可认证，无需额外配置密钥。公共仓库镜像存储免费，拉取免费。

### 2.3 CI/CD：GitHub Actions

| 方案 | 成本 | 触发方式 | 与 GitHub 集成 |
|------|------|----------|----------------|
| **GitHub Actions（选用）** | **公共仓库免费** | **push / PR / 手动** | **原生** |
| Jenkins | 需自建服务器 | Webhook | 需插件 |
| GitLab CI | 有限免费 | push | 需 GitLab |

**选型理由**：公共仓库每月 2000 分钟免费构建时间，与代码仓库原生集成，push to main 自动触发。

### 2.4 部署方式：SSH + Docker Compose

| 方案 | 复杂度 | 实时性 | 资源消耗 |
|------|--------|--------|----------|
| **SSH + docker compose（选用）** | **低** | **即时** | **零额外** |
| Watchtower 自动拉取 | 低 | 5 分钟轮询 | 常驻进程 |
| ArgoCD + GitOps | 高 | 即时 | 需额外组件 |
| Kubernetes | 极高 | 即时 | 4G 内存不够 |

**选型理由**：GitHub Actions 构建完成后通过 SSH 直接在服务器执行 `docker compose pull && up -d`，简单直接，零额外资源消耗。4C4G 服务器不适合运行 Kubernetes，Watchtower 有 5 分钟延迟，SSH 方案最契合。

### 2.5 数据库：MySQL 8.0

| 方案 | 内存占用 | 适用场景 | 生态 |
|------|----------|----------|------|
| **MySQL 8.0（选用）** | **~200 MB** | **通用关系型数据** | **最广泛** |
| PostgreSQL 16 | ~200 MB | 复杂查询 / GIS | 功能更强 |
| SQLite | ~0 MB | 嵌入式 / 单文件 | 无需服务 |

**选型理由**：MySQL 是最广泛使用的关系型数据库，社区资源丰富，与大多数后端框架兼容性最好。8.0 版本支持窗口函数、CTE 等现代 SQL 特性。4C4G 服务器运行 MySQL 无压力。

### 2.6 缓存：Redis 7.x

| 方案 | 内存占用 | 适用场景 | 持久化 |
|------|----------|----------|--------|
| **Redis 7.x（选用）** | **~30 MB** | **缓存 / 会话 / 队列** | **支持** |
| Memcached | ~10 MB | 纯缓存 | 不支持 |
| KeyDB | ~30 MB | 多线程 Redis | 支持 |

**选型理由**：Redis 是最流行的内存数据库，支持丰富的数据结构（String / Hash / List / Set / Sorted Set），可用于缓存、会话管理、消息队列等多种场景。

### 2.7 选型总览

```
构建阶段:  Node.js 20 alpine（构建）→ Nginx alpine（运行）
镜像仓库:  ghcr.io（GitHub Container Registry）
CI/CD:     GitHub Actions
部署方式:  SSH + Docker Compose
数据库:    MySQL 8.0（Docker 容器）
缓存:      Redis 7.x（Docker 容器）
服务器:    4C4G ECS，运行 Docker + Nginx + MySQL + Redis 容器
```

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         开发者本地                                │
│                                                                   │
│   修改代码 → git add → git commit → git push origin main         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub (github.com)                          │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              GitHub Actions 工作流                       │   │
│   │                                                          │   │
│   │   Job 1: build-and-push                                  │   │
│   │   ├── Checkout 代码                                      │   │
│   │   ├── 登录 ghcr.io                                       │   │
│   │   ├── Docker 多阶段构建                                  │   │
│   │   │   ├── node:20-alpine → npm ci → npm run build        │   │
│   │   │   └── nginx:alpine → 复制 dist/ → 产出镜像           │   │
│   │   └── 推送镜像到 ghcr.io/jiangdongshi/aimpad             │   │
│   │       ├── tag: <commit-sha-7位>                          │   │
│   │       └── tag: latest                                    │   │
│   │                                                          │   │
│   │   Job 2: deploy                                          │   │
│   │   └── SSH 到服务器执行部署命令                            │   │
│   │       ├── docker compose pull                            │   │
│   │       ├── docker compose up -d                           │   │
│   │       └── docker image prune -f                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│   ┌─────────────────────┐                                        │
│   │  ghcr.io 镜像仓库    │                                        │
│   │  jiangdongshi/aimpad │                                        │
│   │  ├── :latest         │                                        │
│   │  └── :a1b2c3d        │                                        │
│   └─────────────────────┘                                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ECS 云服务器 (4C4G 60G)                        │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Docker Engine                                           │   │
│   │                                                          │   │
│   │  ┌──────────────────┐  ┌──────────────────┐             │   │
│   │  │ 容器: aimpad     │  │ 容器: mysql      │             │   │
│   │  │ 镜像: nginx:alpine│  │ 镜像: mysql:8.0  │             │   │
│   │  │ 端口: 80 → 80    │  │ 端口: 3306       │             │   │
│   │  │ Nginx 静态文件    │  │ 数据持久化       │             │   │
│   │  └──────────────────┘  └──────────────────┘             │   │
│   │                                                          │   │
│   │  ┌──────────────────┐                                   │   │
│   │  │ 容器: redis      │                                   │   │
│   │  │ 镜像: redis:7-alp│                                   │   │
│   │  │ 端口: 6379       │                                   │   │
│   │  │ 数据持久化       │                                   │   │
│   │  └──────────────────┘                                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│   /opt/aimpad/                                                    │
│   ├── docker-compose.yml                                         │
│   ├── deploy.sh                                                   │
│   ├── data/                                                       │
│   │   ├── mysql/          # MySQL 数据持久化                     │
│   │   └── redis/          # Redis 数据持久化                     │
│   └── config/                                                     │
│       ├── nginx/          # Nginx 自定义配置                     │
│       ├── mysql/          # MySQL 自定义配置                     │
│       └── redis/          # Redis 自定义配置                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户浏览器
    │
    ▼
服务器:80 (Nginx)
    │
    ├── GET /           → /usr/share/nginx/html/index.html
    ├── GET /assets/*   → 长期缓存 (1年, immutable)
    ├── GET /*.glb      → 30天缓存
    └── GET /training   → 回退到 index.html (SPA 路由)

后端 API（扩展时）
    │
    ▼
服务器:3001 (API 服务)
    │
    ├── 查询数据 → MySQL:3306
    └── 缓存数据 → Redis:6379
```

### 3.3 镜像构建流程

```
Dockerfile 多阶段构建:

阶段 1 - builder (node:20-alpine, ~180MB)
├── COPY package.json package-lock.json
├── npm ci --prefer-offline          ← 安装依赖（利用缓存层）
├── COPY . .                         ← 复制源码
└── npm run build                    ← tsc 类型检查 + vite 打包
    └── 产出 /app/dist/              ← 静态文件

阶段 2 - runtime (nginx:alpine, ~25MB)
├── COPY nginx.conf                  ← Nginx 配置
├── COPY --from=builder /app/dist    ← 仅复制构建产物
└── EXPOSE 80

最终镜像: ~25MB (不含 node_modules 和源码)
```

---

## 4. 服务器基础环境配置

### 4.1 系统初始化

#### 4.1.1 更新系统软件包

```bash
# Ubuntu / Debian
sudo apt update && sudo apt upgrade -y

# CentOS 7
sudo yum update -y
```

#### 4.1.2 安装基础工具

```bash
# Ubuntu / Debian
sudo apt install -y curl wget git vim htop net-tools lsof unzip

# CentOS 7
sudo yum install -y curl wget git vim htop net-tools lsof unzip
```

#### 4.1.3 配置时区

```bash
# 设置时区为上海
sudo timedatectl set-timezone Asia/Shanghai

# 验证
date
```

#### 4.1.4 配置 Swap（内存不足时推荐）

4G 内存的服务器建议配置 2G Swap，防止内存耗尽时 OOM Killer 终止进程：

```bash
# 创建 2G Swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 持久化（重启后自动挂载）
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 验证
free -h
```

#### 4.1.5 配置防火墙

```bash
# Ubuntu (ufw)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status

# CentOS 7 (firewalld)
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

> **注意**：MySQL (3306) 和 Redis (6379) 端口默认不对外开放，仅允许容器间或本机访问。如需远程访问数据库，单独开放端口并限制来源 IP。

---

### 4.2 Docker 安装与配置

#### 4.2.1 方式一：官方脚本安装（推荐）

```bash
# 下载并执行官方安装脚本（自动检测发行版）
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 启动 Docker 并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 重新登录 shell 使组权限生效（或执行 newgrp docker）
newgrp docker
```

#### 4.2.2 方式二：APT 仓库安装（Ubuntu / Debian）

```bash
# 安装依赖
sudo apt install -y ca-certificates curl gnupg

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker
```

#### 4.2.3 方式三：YUM 仓库安装（CentOS 7）

```bash
# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
#替换 repo 文件中的地址为阿里云镜像
sed -i 's|https://download.docker.com|https://mirrors.aliyun.com/docker-ce|g' /etc/yum.repos.d/docker-ce.repo
# 导入阿里云镜像的 GPG 公钥
rpm --import https://mirrors.aliyun.com/docker-ce/linux/centos/gpg
# 清理缓存并安装
yum clean all
yum makecache
yum install -y docker-ce docker-ce-cli containerd.io

# 安装 Docker（CentOS 7 无 docker-buildx-plugin 和 docker-compose-plugin，需单独安装）
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker
```

> **CentOS 7 注意**：`docker-buildx-plugin` 和 `docker-compose-plugin` 在 CentOS 7 的 Docker 官方仓库中可能不可用。Docker Compose 需通过 4.3 节单独安装二进制文件方式获取。

#### 4.2.4 验证 Docker 安装

```bash
# 查看 Docker 版本
docker --version
# Docker version 27.x.x, build xxxxxxx

# 查看 Docker 信息
docker info

# 运行测试容器
docker run --rm hello-world
# 看到 "Hello from Docker!" 表示安装成功
```

#### 4.2.5 Docker 镜像加速配置

国内服务器拉取 Docker Hub 镜像较慢，配置镜像加速器：

```bash
# 创建 Docker 配置目录
sudo mkdir -p /etc/docker

# 写入加速器配置
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.1panel.live"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# 重启 Docker 使配置生效
sudo systemctl daemon-reload
sudo systemctl restart docker

# 验证加速器配置
docker info | grep -A 5 "Registry Mirrors"
```

> **说明**：
> - `log-driver` 和 `log-opts`：限制容器日志大小，防止日志占满磁盘
> - `storage-driver: overlay2`：推荐的存储驱动，性能最佳
> - 镜像加速器地址可能变动，如不可用请搜索最新的可用地址

---

### 4.3 Docker Compose 安装

#### 4.3.1 验证 Docker Compose（新版 Docker 自带）

```bash
# 新版 Docker (20.10+) 自带 compose 子命令
docker compose version
# Docker Compose version v2.x.x
```

如果上述命令输出版本号，说明已安装，可跳过后续安装步骤。

#### 4.3.2 方式一：作为 Docker 插件安装

```bash
# 创建插件目录
mkdir -p ~/.docker/cli-plugins/

# 获取最新版本号
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')

# 下载二进制文件
curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o ~/.docker/cli-plugins/docker-compose

# 添加执行权限
chmod +x ~/.docker/cli-plugins/docker-compose

# 验证
docker compose version
```

#### 4.3.3 方式二：全局安装（所有用户可用）

```bash
# 获取最新版本号
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')

# 下载到 /usr/local/bin
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证
docker-compose --version
```

#### 4.3.4 验证安装

```bash
# 插件方式（推荐）
docker compose version

# 独立二进制方式
docker-compose --version
```

---

## 5. Nginx 安装与配置

### 5.1 Docker 容器内 Nginx（当前方案）

AimPad 当前使用 Docker 容器内的 Nginx 提供静态文件服务，无需在宿主机单独安装 Nginx。

#### 5.1.1 Nginx 配置文件

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # === Gzip 压缩 ===
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff2;

    # === 静态资源长期缓存（Vite 构建的文件名带 hash） ===
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # === 3D 模型、纹理、音效 ===
    location ~* \.(glb|gltf|png|jpg|jpeg|webp|avif|mp3|ogg|wav)$ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # === SPA 路由回退 ===
    location / {
        try_files $uri $uri/ /index.html;
    }

    # === 安全头 ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # === 禁止访问隐藏文件 ===
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

#### 5.1.2 缓存策略

```
/assets/index-abc123.js   → Cache-Control: public, max-age=31536000, immutable
/assets/index-def456.css  → Cache-Control: public, max-age=31536000, immutable
/models/scene.glb         → Cache-Control: public, max-age=2592000
/index.html               → 不缓存（每次请求最新版本）
```

Vite 构建时会为 JS/CSS 文件名添加 hash（如 `index-abc123.js`），内容变化则 hash 变化，浏览器自动请求新文件。`index.html` 不被缓存，确保用户始终获取最新的资源引用。

#### 5.1.3 常用调试命令

```bash
# 进入容器内部
docker exec -it aimpad sh

# 查看 Nginx 完整配置
docker exec aimpad nginx -T

# 测试 Nginx 配置语法
docker exec aimpad nginx -t

# 查看访问日志
docker exec aimpad tail -f /var/log/nginx/access.log

# 查看错误日志
docker exec aimpad tail -f /var/log/nginx/error.log

# 重载配置（不重启容器）
docker exec aimpad nginx -s reload
```

---

### 5.2 宿主机 Nginx 反向代理（扩展方案）

当需要在同一台服务器运行多个服务（如前端 + 后端 API + 多个项目）时，建议在宿主机安装 Nginx 作为统一入口，反向代理到各个 Docker 容器。

#### 5.2.1 安装 Nginx

```bash
# Ubuntu / Debian
sudo apt install -y nginx

# CentOS 7
sudo yum install -y epel-release
sudo yum install -y nginx

# 启动并设置开机自启
sudo systemctl enable nginx
sudo systemctl start nginx

# 验证
nginx -v
curl -sI http://localhost
```

#### 5.2.2 反向代理配置

创建配置文件 `/etc/nginx/conf.d/aimpad.conf`：

```nginx
# AimPad 前端静态文件
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    # 静态文件直接由 Nginx 容器处理
    # 这里通过反向代理转发到 Docker 容器
    location / {
        proxy_pass http://127.0.0.1:8080;  # aimpad 容器映射到 8080 端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API 代理（扩展时使用）
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;  # API 容器映射到 3001 端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 5.2.3 修改 docker-compose.yml 端口映射

当使用宿主机 Nginx 反向代理时，AimPad 容器不再直接映射 80 端口：

```yaml
services:
  aimpad:
    image: ghcr.io/jiangdongshi/aimpad:latest
    container_name: aimpad
    ports:
      - "8080:80"    # 改为 8080，避免与宿主机 Nginx 冲突
    restart: unless-stopped
```

#### 5.2.4 启用配置并测试

```bash
# 测试配置语法
sudo nginx -t

# 重载配置
sudo nginx -s reload

# 验证
curl -sI http://your-domain.com
```

#### 5.2.5 HTTPS 配置（Let's Encrypt）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx   # Ubuntu/Debian
# 或
sudo yum install -y certbot python3-certbot-nginx   # CentOS 7

# 申请证书（确保域名已解析到服务器 IP）
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run

# certbot 会自动修改 nginx 配置并添加定时续期任务
```

---

## 6. MySQL 安装与配置

### 6.1 Docker 方式部署 MySQL

#### 6.1.1 创建数据目录

```bash
# 创建 MySQL 数据持久化目录
mkdir -p /opt/aimpad/data/mysql
mkdir -p /opt/aimpad/config/mysql
```

#### 6.1.2 MySQL 自定义配置文件

创建 `/opt/aimpad/config/mysql/custom.cnf`：

```ini
[mysqld]
# === 基础配置 ===
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
default-time-zone = '+08:00'

# === 性能优化（4G 内存服务器） ===
innodb_buffer_pool_size = 512M        # InnoDB 缓冲池，建议为物理内存的 50-70%
innodb_log_file_size = 64M            # Redo log 文件大小
innodb_flush_log_at_trx_commit = 1    # 事务提交时刷盘（数据安全优先）
innodb_flush_method = O_DIRECT        # 避免双重缓存

# === 连接配置 ===
max_connections = 100                 # 最大连接数
wait_timeout = 600                    # 空闲连接超时（秒）
interactive_timeout = 600

# === 查询缓存（MySQL 8.0 已移除查询缓存） ===
tmp_table_size = 32M
max_heap_table_size = 32M

# === 慢查询日志 ===
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2                   # 超过 2 秒的查询记录到慢查询日志

# === 二进制日志（用于数据恢复和主从复制） ===
server-id = 1
log_bin = /var/log/mysql/mysql-bin
binlog_expire_logs_seconds = 604800   # 二进制日志保留 7 天
max_binlog_size = 100M

[client]
default-character-set = utf8mb4
```

#### 6.1.3 docker-compose.yml 中添加 MySQL 服务

```yaml
services:
  # ... aimpad 服务保持不变 ...

  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}       # 从 .env 文件读取
      MYSQL_DATABASE: aimpad
      MYSQL_USER: aimpad_user
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      TZ: Asia/Shanghai
    volumes:
      - ./data/mysql:/var/lib/mysql                     # 数据持久化
      - ./config/mysql/custom.cnf:/etc/mysql/conf.d/custom.cnf  # 自定义配置
      - ./data/mysql/log:/var/log/mysql                 # 日志持久化
    command: >
      --default-authentication-plugin=caching_sha2_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - aimpad-net
```

#### 6.1.4 创建环境变量文件

创建 `/opt/aimpad/.env`：

```bash
# MySQL
MYSQL_ROOT_PASSWORD=your_strong_root_password_here
MYSQL_PASSWORD=your_strong_user_password_here

# Redis
REDIS_PASSWORD=your_strong_redis_password_here
```

> **安全提示**：`.env` 文件包含敏感密码，确保已添加到 `.gitignore`，不要提交到 Git 仓库。

#### 6.1.5 启动 MySQL

```bash
cd /opt/aimpad

# 仅启动 MySQL 服务
docker compose up -d mysql

# 查看状态
docker compose ps mysql

# 查看日志
docker compose logs -f mysql

# 等待健康检查通过（首次启动需要初始化数据库，约 30-60 秒）
docker compose ps mysql
# 状态应显示 healthy
```

#### 6.1.6 连接测试

```bash
# 方式 1: 从宿主机连接（需要安装 mysql-client）
# Ubuntu/Debian: sudo apt install -y mysql-client
# CentOS 7: sudo yum install -y mysql
mysql -h 127.0.0.1 -P 3306 -u aimpad_user -p

# 方式 2: 进入容器内部连接
docker exec -it mysql mysql -u aimpad_user -p

# 方式 3: 使用 root 连接
docker exec -it mysql mysql -u root -p

# 连接后验证
SHOW DATABASES;
USE aimpad;
SELECT 1;
```

---

### 6.2 宿主机方式安装 MySQL

如果不使用 Docker，也可以直接在宿主机安装 MySQL。

#### 6.2.1 Ubuntu / Debian 安装

```bash
# 安装 MySQL 8.0
sudo apt install -y mysql-server

# 启动并设置开机自启
sudo systemctl enable mysql
sudo systemctl start mysql

# 安全初始化（设置 root 密码、删除匿名用户等）
sudo mysql_secure_installation
```

#### 6.2.2 CentOS 7 安装

```bash
# 添加 MySQL 官方仓库（CentOS 7 使用 el7 版本）
sudo yum install -y https://dev.mysql.com/get/mysql80-community-release-el7-11.noarch.rpm

# 安装 MySQL 服务器
sudo yum install -y mysql-community-server

# 启动并设置开机自启
sudo systemctl enable mysqld
sudo systemctl start mysqld

# 获取临时 root 密码
sudo grep 'temporary password' /var/log/mysqld.log

# 安全初始化
sudo mysql_secure_installation
```

#### 6.2.3 创建数据库和用户

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE aimpad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权
CREATE USER 'aimpad_user'@'%' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON aimpad.* TO 'aimpad_user'@'%';
FLUSH PRIVILEGES;

-- 验证
SHOW DATABASES;
SELECT user, host FROM mysql.user;
```

---

### 6.3 MySQL 基础配置与安全加固

#### 6.3.1 安全初始化（Docker 方式）

```bash
# 进入 MySQL 容器
docker exec -it mysql mysql -u root -p

# 执行安全操作
```

```sql
-- 1. 删除匿名用户
DELETE FROM mysql.user WHERE User='';
FLUSH PRIVILEGES;

-- 2. 禁止 root 远程登录
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;

-- 3. 删除测试数据库
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;

-- 4. 查看用户权限
SELECT user, host, plugin FROM mysql.user;
SHOW GRANTS FOR 'aimpad_user'@'%';
```

#### 6.3.2 限制远程访问

默认情况下，MySQL 容器的 3306 端口仅映射到宿主机的 127.0.0.1，外部无法直接访问。如果需要远程访问：

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:3306:3306"   # 仅本机访问（默认推荐）
  # - "0.0.0.0:3306:3306"   # 所有网络可访问（谨慎使用）
```

如需限制特定 IP 访问，使用防火墙规则：

```bash
# Ubuntu (ufw)
sudo ufw allow from 你的IP地址 to any port 3306

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="你的IP地址" port protocol="tcp" port="3306" accept'
sudo firewall-cmd --reload
```

#### 6.3.3 修改 root 密码

```bash
# Docker 方式
docker exec -it mysql mysql -u root -p

# 宿主机方式
mysql -u root -p
```

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_strong_password';
FLUSH PRIVILEGES;
```

---

### 6.4 MySQL 备份与恢复

#### 6.4.1 手动备份

```bash
# Docker 方式：备份指定数据库
docker exec mysql mysqldump -u root -p --single-transaction --routines --triggers aimpad \
  > /opt/aimpad/data/mysql/backup/aimpad_$(date +%Y%m%d_%H%M%S).sql

# 备份所有数据库
docker exec mysql mysqldump -u root -p --all-databases --single-transaction \
  > /opt/aimpad/data/mysql/backup/all_$(date +%Y%m%d_%H%M%S).sql

# 压缩备份
docker exec mysql mysqldump -u root -p --single-transaction aimpad | gzip \
  > /opt/aimpad/data/mysql/backup/aimpad_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### 6.4.2 自动定时备份

创建备份脚本 `/opt/aimpad/scripts/backup-mysql.sh`：

```bash
#!/bin/bash
# MySQL 自动备份脚本
set -e

BACKUP_DIR="/opt/aimpad/data/mysql/backup"
CONTAINER_NAME="mysql"
DB_NAME="aimpad"
DB_USER="root"
DB_PASS="${MYSQL_ROOT_PASSWORD}"
KEEP_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
FILENAME="${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# 执行备份
docker exec "$CONTAINER_NAME" mysqldump -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --triggers "$DB_NAME" | gzip > "$FILEPATH"

# 删除过期备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${KEEP_DAYS} -delete

echo "[$(date)] Backup completed: $FILENAME"
```

添加定时任务：

```bash
# 添加执行权限
chmod +x /opt/aimpad/scripts/backup-mysql.sh

# 编辑 crontab
crontab -e

# 添加每天凌晨 3 点执行备份
0 3 * * * /opt/aimpad/scripts/backup-mysql.sh >> /opt/aimpad/data/mysql/backup/backup.log 2>&1
```

#### 6.4.3 恢复数据

```bash
# 从 SQL 文件恢复
docker exec -i mysql mysql -u root -p aimpad < /opt/aimpad/data/mysql/backup/aimpad_20260430_030000.sql

# 从压缩文件恢复
gunzip < /opt/aimpad/data/mysql/backup/aimpad_20260430_030000.sql.gz | docker exec -i mysql mysql -u root -p aimpad
```

---

## 7. Redis 安装与配置

### 7.1 Docker 方式部署 Redis

#### 7.1.1 创建数据目录

```bash
# 创建 Redis 数据持久化目录
mkdir -p /opt/aimpad/data/redis
mkdir -p /opt/aimpad/config/redis
```

#### 7.1.2 Redis 自定义配置文件

创建 `/opt/aimpad/config/redis/redis.conf`：

```ini
# === 网络绑定 ===
bind 0.0.0.0
protected-mode yes
port 6379

# === 认证 ===
requirepass your_strong_redis_password

# === 内存管理（4G 内存服务器） ===
maxmemory 256mb                       # 最大内存限制
maxmemory-policy allkeys-lru          # 内存满时淘汰策略：LRU 淘汰最近最少使用的 key

# === 持久化 - RDB 快照 ===
save 900 1                            # 900 秒内至少 1 个 key 变化则保存
save 300 10                           # 300 秒内至少 10 个 key 变化则保存
save 60 10000                         # 60 秒内至少 10000 个 key 变化则保存
rdbcompression yes                    # 启用 RDB 压缩
rdbchecksum yes                       # 启用 RDB 校验
dbfilename dump.rdb                   # RDB 文件名
dir /data                             # 数据目录（容器内路径）

# === 持久化 - AOF 追加 ===
appendonly yes                        # 启用 AOF
appendfilename "appendonly.aof"       # AOF 文件名
appendfsync everysec                  # 每秒同步一次（性能与安全的平衡）
auto-aof-rewrite-percentage 100       # AOF 文件增长 100% 时触发重写
auto-aof-rewrite-min-size 64mb        # AOF 文件最小 64MB 才触发重写

# === 日志 ===
loglevel notice
logfile "/data/redis.log"

# === 连接 ===
timeout 300                           # 空闲连接超时（秒）
tcp-keepalive 60                      # TCP 保活间隔

# === 安全 ===
rename-command FLUSHDB ""             # 禁用 FLUSHDB 命令（可选）
rename-command FLUSHALL ""            # 禁用 FLUSHALL 命令（可选）
rename-command CONFIG ""              # 禁用 CONFIG 命令（可选，调试时可恢复）
```

#### 7.1.3 docker-compose.yml 中添加 Redis 服务

```yaml
services:
  # ... aimpad、mysql 服务保持不变 ...

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - ./data/redis:/data                                  # 数据持久化
      - ./config/redis/redis.conf:/usr/local/etc/redis/redis.conf  # 自定义配置
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - aimpad-net
```

#### 7.1.4 启动 Redis

```bash
cd /opt/aimpad

# 仅启动 Redis 服务
docker compose up -d redis

# 查看状态
docker compose ps redis

# 查看日志
docker compose logs -f redis
```

#### 7.1.5 连接测试

```bash
# 方式 1: 从宿主机连接（需要安装 redis-cli）
# Ubuntu/Debian: sudo apt install -y redis-tools
# CentOS 7: sudo yum install -y redis
redis-cli -h 127.0.0.1 -p 6379 -a your_strong_redis_password

# 方式 2: 进入容器内部连接
docker exec -it redis redis-cli -a your_strong_redis_password

# 连接后验证
PING
# 应返回 PONG

SET test "hello"
GET test
# 应返回 "hello"

DEL test
INFO server
```

---

### 7.2 宿主机方式安装 Redis

#### 7.2.1 Ubuntu / Debian 安装

```bash
# 安装 Redis
sudo apt install -y redis-server

# 启动并设置开机自启
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 验证
redis-cli ping
# 应返回 PONG
```

#### 7.2.2 CentOS 7 安装

```bash
# 安装 EPEL 仓库
sudo yum install -y epel-release

# 安装 Redis
sudo yum install -y redis

# 启动并设置开机自启
sudo systemctl enable redis
sudo systemctl start redis

# 验证
redis-cli ping
```

#### 7.2.3 编译安装（获取最新版本）

```bash
# 安装编译依赖
sudo apt install -y build-essential tcl   # Ubuntu/Debian
# 或
sudo yum install -y gcc make tcl          # CentOS 7

# 下载并编译
REDIS_VERSION="7.2.4"
cd /tmp
curl -O https://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz
tar xzf redis-${REDIS_VERSION}.tar.gz
cd redis-${REDIS_VERSION}
make
sudo make install

# 创建配置目录和数据目录
sudo mkdir -p /etc/redis /var/lib/redis

# 复制配置文件
sudo cp redis.conf /etc/redis/redis.conf

# 创建 systemd 服务文件
sudo tee /etc/systemd/system/redis.service << 'EOF'
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/local/bin/redis-cli shutdown
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 创建 redis 用户
sudo useradd -r -s /bin/false redis
sudo chown redis:redis /var/lib/redis

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable redis
sudo systemctl start redis
```

---

### 7.3 Redis 基础配置与安全加固

#### 7.3.1 安全配置要点

```bash
# 编辑 Redis 配置
# Docker: /opt/aimpad/config/redis/redis.conf
# 宿主机: /etc/redis/redis.conf
```

**必须配置的安全项：**

```ini
# 1. 设置密码（必须）
requirepass your_strong_password

# 2. 绑定地址（限制访问来源）
bind 127.0.0.1                     # 仅本机访问
# 或
bind 127.0.0.1 172.20.0.1          # 本机 + Docker 网络

# 3. 启用保护模式
protected-mode yes

# 4. 禁用危险命令（可选，根据业务需要）
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command DEBUG ""
```

#### 7.3.2 限制远程访问

```yaml
# docker-compose.yml - 仅允许本机访问
ports:
  - "127.0.0.1:6379:6379"
```

```bash
# 防火墙规则（如需远程访问）
sudo ufw allow from 你的IP地址 to any port 6379
```

#### 7.3.3 持久化策略选择

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| RDB（快照） | 文件小、恢复快 | 可能丢失最后一次快照后的数据 | 备份、灾难恢复 |
| AOF（追加） | 数据更安全、最多丢 1 秒数据 | 文件较大、恢复较慢 | 数据安全优先 |
| **RDB + AOF（推荐）** | **兼顾安全与恢复速度** | **占用更多磁盘** | **生产环境** |

配置文件中已同时启用 RDB 和 AOF，Redis 重启时会优先使用 AOF 恢复数据（数据更完整）。

#### 7.3.4 内存管理

```bash
# 查看 Redis 内存使用
docker exec redis redis-cli -a your_password INFO memory

# 查看 key 数量
docker exec redis redis-cli -a your_password DBSIZE

# 查看慢查询日志
docker exec redis redis-cli -a your_password SLOWLOG GET 10
```

**内存淘汰策略说明：**

| 策略 | 说明 |
|------|------|
| `noeviction` | 内存满时拒绝写入（默认） |
| `allkeys-lru` | 从所有 key 中淘汰最近最少使用的（**推荐**） |
| `volatile-lru` | 从设置了过期时间的 key 中淘汰 LRU |
| `allkeys-random` | 从所有 key 中随机淘汰 |
| `volatile-ttl` | 淘汰 TTL 最短的 key |

---

## 8. 完整 Docker Compose 编排

### 8.1 完整 docker-compose.yml

将所有服务整合到一个编排文件中：

```yaml
# /opt/aimpad/docker-compose.yml

services:
  # ============================================
  # AimPad 前端（Nginx 静态文件服务）
  # ============================================
  aimpad:
    image: ghcr.io/jiangdongshi/aimpad:latest
    container_name: aimpad
    ports:
      - "80:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - aimpad-net

  # ============================================
  # MySQL 8.0 数据库
  # ============================================
  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: unless-stopped
    ports:
      - "127.0.0.1:3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: aimpad
      MYSQL_USER: aimpad_user
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      TZ: Asia/Shanghai
    volumes:
      - ./data/mysql:/var/lib/mysql
      - ./config/mysql/custom.cnf:/etc/mysql/conf.d/custom.cnf:ro
      - ./data/mysql/log:/var/log/mysql
    command: >
      --default-authentication-plugin=caching_sha2_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - aimpad-net

  # ============================================
  # Redis 7.x 缓存
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - ./data/redis:/data
      - ./config/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - aimpad-net

# ============================================
# 网络配置
# ============================================
networks:
  aimpad-net:
    driver: bridge
```

### 8.2 目录结构

部署完成后的目录结构：

```
/opt/aimpad/
├── docker-compose.yml              # 容器编排配置
├── .env                            # 环境变量（密码等敏感信息）
├── deploy.sh                       # 手动部署脚本
├── scripts/
│   ├── setup-server.sh             # 服务器初始化脚本
│   └── backup-mysql.sh             # MySQL 备份脚本
├── config/
│   ├── mysql/
│   │   └── custom.cnf              # MySQL 自定义配置
│   └── redis/
│       └── redis.conf              # Redis 自定义配置
└── data/
    ├── mysql/                      # MySQL 数据持久化
    │   ├── backup/                 # 备份文件
    │   └── log/                    # MySQL 日志
    └── redis/                      # Redis 数据持久化
        ├── dump.rdb                # RDB 快照
        ├── appendonly.aof          # AOF 追加文件
        └── redis.log               # Redis 日志
```

### 8.3 初始化目录结构脚本

创建 `/opt/aimpad/scripts/init-dirs.sh`：

```bash
#!/bin/bash
# 初始化部署目录结构
set -e

DEPLOY_PATH="/opt/aimpad"

echo "==> 创建目录结构..."
mkdir -p "$DEPLOY_PATH"/{config/{mysql,redis},data/{mysql/{backup,log},redis},scripts}

echo "==> 目录结构已创建："
tree "$DEPLOY_PATH" -L 3 2>/dev/null || find "$DEPLOY_PATH" -maxdepth 3 -type d

echo ""
echo "接下来需要："
echo "1. 创建 $DEPLOY_PATH/.env 文件（填写密码）"
echo "2. 创建 $DEPLOY_PATH/config/mysql/custom.cnf"
echo "3. 创建 $DEPLOY_PATH/config/redis/redis.conf"
echo "4. 创建 $DEPLOY_PATH/docker-compose.yml"
echo "5. 执行 docker compose up -d"
```

### 8.4 常用管理命令

```bash
# === 服务管理 ===
cd /opt/aimpad

# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启所有服务
docker compose restart

# 仅重启某个服务
docker compose restart mysql
docker compose restart redis
docker compose restart aimpad

# === 状态查看 ===

# 查看所有容器状态
docker compose ps

# 查看资源占用（CPU / 内存 / 网络）
docker stats --no-stream

# 查看某个服务的日志
docker compose logs -f mysql
docker compose logs -f redis
docker compose logs -f aimpad

# 最近 100 行日志
docker compose logs --tail 100 mysql

# === 数据管理 ===

# 进入 MySQL 命令行
docker exec -it mysql mysql -u aimpad_user -p

# 进入 Redis 命令行
docker exec -it redis redis-cli -a ${REDIS_PASSWORD}

# 备份 MySQL
docker exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} --single-transaction aimpad \
  > /opt/aimpad/data/mysql/backup/aimpad_$(date +%Y%m%d).sql

# === 磁盘管理 ===

# 查看 Docker 磁盘占用
docker system df

# 清理未使用的镜像
docker image prune -f

# 清理所有未使用的资源
docker system prune -f
```

---

## 9. Docker 镜像构建

### 9.1 Dockerfile 完整内容

```dockerfile
# ============================================
# 阶段 1: 构建
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci --prefer-offline

# 复制源码
COPY . .

# 构建（tsc 类型检查 + vite 打包）
RUN npm run build

# ============================================
# 阶段 2: 运行
# ============================================
FROM nginx:alpine

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 9.2 构建优化说明

| 优化项 | 做法 | 效果 |
|--------|------|------|
| 依赖缓存 | 先 COPY package*.json，再 npm ci | 依赖未变时跳过安装，节省 60%+ 构建时间 |
| 多阶段构建 | builder 阶段不进入最终镜像 | 最终镜像不含 node_modules（~180MB → ~25MB） |
| alpine 基础镜像 | 使用 alpine 变体 | 镜像体积比 debian 小 10 倍 |
| npm ci | 使用 ci 而非 install | 严格按 lock 文件安装，更快更可靠 |

### 9.3 本地构建测试

```bash
# 构建镜像
docker build -t aimpad:test .

# 运行测试
docker run -p 8080:80 aimpad:test

# 浏览器访问 http://localhost:8080
```

---

## 10. GitHub Actions CI/CD 工作流

### 10.1 工作流配置

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:  # 支持手动触发

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ============================================
  # Job 1: 构建并推送 Docker 镜像
  # ============================================
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image_tag: ${{ steps.meta.outputs.version }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ============================================
  # Job 2: 部署到服务器
  # ============================================
  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd ${{ secrets.SERVER_DEPLOY_PATH }}
            docker compose pull
            docker compose up -d --remove-orphans
            docker image prune -f
            echo "Deployed commit: ${{ github.sha }}"
```

### 10.2 工作流详解

#### 触发条件

| 触发方式 | 条件 | 说明 |
|----------|------|------|
| 自动触发 | push 到 main 分支 | 日常开发使用 |
| 手动触发 | workflow_dispatch | 在 Actions 页面点击 "Run workflow" |

#### Job 1: build-and-push

```
步骤 1: Checkout
  └── 拉取代码到构建服务器

步骤 2: Login to GHCR
  └── 使用 GITHUB_TOKEN 自动登录（无需额外配置）

步骤 3: Extract metadata
  └── 生成镜像 tag:
      ├── ghcr.io/jiangdongshi/aimpad:a1b2c3d  (commit SHA 前 7 位)
      └── ghcr.io/jiangdongshi/aimpad:latest

步骤 4: Build and push
  ├── 构建 Docker 镜像（多阶段）
  ├── 使用 GitHub Actions 缓存加速（cache-from/to: type=gha）
  └── 推送到 ghcr.io
```

#### Job 2: deploy

```
需要 Job 1 完成后才执行（needs: build-and-push）

步骤: SSH 到服务器
  ├── cd /opt/aimpad
  ├── docker compose pull      ← 拉取最新镜像
  ├── docker compose up -d     ← 启动新容器（旧容器自动替换）
  └── docker image prune -f    ← 清理悬空镜像释放磁盘
```

### 10.3 镜像 Tag 策略

每次构建产生两个 tag：

| Tag | 示例 | 用途 |
|-----|------|------|
| `<commit-sha>` | `a1b2c3d` | 版本追溯，可回滚到特定版本 |
| `latest` | `latest` | 默认使用，始终指向最新构建 |

### 10.4 构建缓存

使用 GitHub Actions Cache（`type=gha`）缓存 Docker 构建层：

```
首次构建: ~3-5 分钟（npm ci + vite build）
后续构建: ~1-2 分钟（依赖未变时跳过 npm ci）
```

---

## 11. GitHub Secrets 配置

### 11.1 配置步骤

1. 进入 GitHub 仓库页面
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret** 添加以下配置

### 11.2 必需的 Secrets

| Secret 名称 | 值 | 获取方式 |
|-------------|-----|----------|
| `SERVER_HOST` | 服务器公网 IP | 如 `123.45.67.89` |
| `SERVER_USER` | SSH 用户名 | 如 `root` |
| `SERVER_SSH_KEY` | SSH 私钥内容 | 见下方生成方法 |
| `SERVER_DEPLOY_PATH` | 部署目录 | 如 `/opt/aimpad` |

> `GITHUB_TOKEN` 由 GitHub 自动提供，无需手动配置。

### 11.3 生成 SSH 密钥对

在本地电脑执行：

```bash
# 生成密钥对（一路回车使用默认值）
ssh-keygen -t ed25519 -C "aimpad-deploy" -f ~/.ssh/aimpad_deploy

# 输出:
# ~/.ssh/aimpad_deploy      ← 私钥（配置到 GitHub Secret）
# ~/.ssh/aimpad_deploy.pub  ← 公钥（配置到服务器）
```

将公钥添加到服务器：

```bash
# 方式 1: ssh-copy-id（推荐）
ssh-copy-id -i ~/.ssh/aimpad_deploy.pub root@你的服务器IP

# 方式 2: 手动追加
cat ~/.ssh/aimpad_deploy.pub | ssh root@你的服务器IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

将私钥内容复制到 GitHub Secret `SERVER_SSH_KEY`：

```bash
# macOS
cat ~/.ssh/aimpad_deploy | pbcopy

# Linux
cat ~/.ssh/aimpad_deploy

# Windows (Git Bash)
cat ~/.ssh/aimpad_deploy | clip
```

### 11.4 验证 Secrets 配置

在 GitHub Actions 中可以手动触发工作流验证：

1. 进入仓库 **Actions** 页面
2. 选择 **Build & Deploy** 工作流
3. 点击 **Run workflow** → **Run workflow**
4. 观察 Job 1（构建）和 Job 2（部署）是否成功

---

## 12. 日常部署流程

### 12.1 完整流程

```
1. 本地修改代码
2. git add .
3. git commit -m "feat: 新功能描述"
4. git push origin main
5. GitHub Actions 自动触发（约 3-5 分钟）
6. 浏览器访问 http://服务器IP 验证
```

### 12.2 详细步骤

```bash
# 1. 确认在 main 分支
git checkout main

# 2. 修改代码...

# 3. 查看变更
git status
git diff

# 4. 暂存并提交
git add .
git commit -m "feat: 添加新训练任务"

# 5. 推送到 GitHub
git push origin main

# 6. 查看构建状态
# 访问 https://github.com/jiangdongshi/AimPad/actions
# 等待绿色勾号 ✓

# 7. 验证部署
curl -s http://你的服务器IP | head -20
```

### 12.3 部署时间线

```
T+0s     git push
T+5s     GitHub Actions 触发
T+10s    Checkout 代码
T+20s    Docker 构建开始
T+60s    npm ci 完成（有缓存时更快）
T+90s    npm run build 完成
T+100s   镜像推送完成
T+110s   SSH 到服务器执行部署
T+120s   docker compose pull + up 完成
T+120s   新版本上线
```

总计约 **2-3 分钟**（首次构建约 5 分钟，后续有缓存加速）。

---

## 13. 手动部署与回滚

### 13.1 手动部署

在服务器上执行：

```bash
cd /opt/aimpad
bash deploy.sh
```

或直接执行命令：

```bash
cd /opt/aimpad
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
```

### 13.2 版本回滚

查看可用版本：

```bash
# 查看本地镜像列表
docker images ghcr.io/jiangdongshi/aimpad
```

回滚到指定版本：

```bash
cd /opt/aimpad

# 修改 docker-compose.yml 中的镜像 tag
# 将 :latest 改为 :<commit-sha>
sed -i 's/:latest/:a1b2c3d/' docker-compose.yml

# 拉取并启动
docker compose pull
docker compose up -d

# 验证
docker compose ps
```

恢复到最新版本：

```bash
sed -i 's/:a1b2c3d/:latest/' docker-compose.yml
docker compose pull
docker compose up -d
```

---

## 14. 监控与日志

### 14.1 查看日志

```bash
# 实时日志
docker compose logs -f

# 最近 100 行
docker compose logs --tail 100

# 指定时间范围
docker compose logs --since "2026-04-30T10:00:00"
```

### 14.2 容器状态

```bash
# 容器状态
docker compose ps

# 资源占用（CPU / 内存 / 网络 / 磁盘）
docker stats aimpad mysql redis --no-stream

# 健康检查状态
docker inspect aimpad --format='{{.State.Health.Status}}'
docker inspect mysql --format='{{.State.Health.Status}}'
docker inspect redis --format='{{.State.Health.Status}}'
```

### 14.3 磁盘管理

```bash
# 查看 Docker 磁盘占用
docker system df

# 清理未使用的镜像和容器
docker system prune -f

# 清理所有未使用的资源（包括未使用的镜像）
docker system prune -a -f

# 查看数据目录大小
du -sh /opt/aimpad/data/*
```

---

## 15. 故障排查

### 15.1 GitHub Actions 构建失败

| 问题 | 原因 | 解决 |
|------|------|------|
| `npm ci` 失败 | 依赖 lock 文件不一致 | 本地运行 `npm install` 更新 lock 文件 |
| `tsc` 类型检查失败 | TypeScript 错误 | 本地运行 `npm run build` 修复错误 |
| 推送镜像失败 | GHCR 权限不足 | 检查仓库 Settings → Actions → General → Workflow permissions |
| SSH 部署失败 | Secrets 配置错误 | 检查 SERVER_HOST / SERVER_USER / SERVER_SSH_KEY |

### 15.2 服务器容器异常

| 问题 | 原因 | 解决 |
|------|------|------|
| 容器反复重启 | 配置错误 | `docker compose logs` 查看错误日志 |
| 无法访问 | 端口被占用 | `lsof -i :80` 检查端口占用 |
| 镜像拉取失败 | GHCR 未登录 | `docker login ghcr.io` 重新登录 |
| 磁盘空间不足 | 旧镜像堆积 | `docker system prune -a -f` 清理 |

### 15.3 MySQL 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 启动失败 | 数据目录权限问题 | 检查 `data/mysql/` 目录权限 |
| 连接被拒绝 | 密码错误或用户未创建 | 检查 `.env` 文件中的密码配置 |
| 连接超时 | 容器未就绪 | 等待 healthcheck 通过，查看 `docker compose logs mysql` |
| 磁盘满 | 二进制日志未清理 | 执行 `PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 7 DAY);` |
| 内存不足 | `innodb_buffer_pool_size` 过大 | 减小到 256M 或更小 |

```bash
# 查看 MySQL 错误日志
docker compose logs mysql --tail 50

# 进入 MySQL 检查状态
docker exec -it mysql mysql -u root -p -e "SHOW ENGINE INNODB STATUS\G"

# 查看连接数
docker exec -it mysql mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
```

### 15.4 Redis 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 启动失败 | 配置文件语法错误 | 检查 `config/redis/redis.conf` 语法 |
| 连接被拒绝 | 密码错误 | 检查 `.env` 和 `redis.conf` 中的密码是否一致 |
| 内存满 | 达到 `maxmemory` 限制 | 检查淘汰策略，或增大 `maxmemory` |
| 数据丢失 | 未启用持久化 | 确认 AOF 和 RDB 已启用 |
| 慢查询 | 大 key 操作 | 使用 `SLOWLOG GET` 查看慢查询 |

```bash
# 查看 Redis 日志
docker compose logs redis --tail 50

# 检查 Redis 状态
docker exec redis redis-cli -a your_password INFO

# 查看内存使用
docker exec redis redis-cli -a your_password INFO memory

# 查看慢查询
docker exec redis redis-cli -a your_password SLOWLOG GET 10

# 检查持久化状态
docker exec redis redis-cli -a your_password LASTSAVE
```

### 15.5 页面访问异常

| 问题 | 原因 | 解决 |
|------|------|------|
| 白屏 | JS 加载失败 | 检查浏览器控制台，确认资源路径正确 |
| 刷新 404 | SPA 路由未回退 | 检查 nginx.conf 中 `try_files` 配置 |
| 样式丢失 | CSS 缓存问题 | 确认 `index.html` 未被缓存 |
| 3D 场景不显示 | WebGL 不支持 | 确认浏览器支持 WebGL，检查控制台错误 |

### 15.6 常用调试命令

```bash
# 进入容器内部调试
docker exec -it aimpad sh
docker exec -it mysql bash
docker exec -it redis sh

# 查看容器网络
docker network inspect aimpad_aimpad-net

# 查看容器资源限制
docker inspect aimpad --format='{{.HostConfig.Memory}}'

# 查看容器启动时间
docker inspect aimpad --format='{{.State.StartedAt}}'
```

---

## 16. 安全加固

### 16.1 服务器防火墙

```bash
# Ubuntu (ufw)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS（后续扩展）
ufw enable

# CentOS 7 (firewalld)
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

> **注意**：MySQL (3306) 和 Redis (6379) 端口仅绑定到 `127.0.0.1`，不对外开放。

### 16.2 SSH 安全

编辑 `/etc/ssh/sshd_config`：

```bash
# 禁用密码登录（使用密钥登录后）
PasswordAuthentication no

# 禁用 root 密码登录
PermitRootLogin prohibit-password

# 修改默认端口（可选）
Port 22222

# 重启 SSH
systemctl restart sshd
```

### 16.3 Docker 安全

```bash
# 1. 不要以 root 运行容器（除非必要）
# 2. 限制容器资源
# 在 docker-compose.yml 中添加:
#   deploy:
#     resources:
#       limits:
#         cpus: '1.0'
#         memory: 512M

# 3. 只读文件系统（适用于无状态容器）
#   read_only: true

# 4. 定期更新镜像
docker compose pull
docker compose up -d
```

### 16.4 数据库安全

- MySQL 和 Redis 仅允许本机或 Docker 内部网络访问
- 使用强密码（至少 16 位，包含大小写字母、数字、特殊字符）
- 定期更换密码
- 定期备份数据
- 启用慢查询日志监控异常查询

### 16.5 定期安全更新

```bash
# 创建自动更新脚本 /opt/aimpad/scripts/security-update.sh
#!/bin/bash
set -e

echo "[$(date)] Starting security update..."

# 更新系统软件包
yum update -y

# 更新 Docker 镜像
cd /opt/aimpad
docker compose pull
docker compose up -d

# 清理旧镜像
docker image prune -f

echo "[$(date)] Security update completed."
```

```bash
# 添加执行权限
chmod +x /opt/aimpad/scripts/security-update.sh

# 添加到 crontab（每周日凌晨 4 点执行）
crontab -e
0 4 * * 0 /opt/aimpad/scripts/security-update.sh >> /opt/aimpad/data/update.log 2>&1
```

---

## 附录 A：资源占用估算

### 服务器资源分配

| 组件 | CPU | 内存 | 磁盘 |
|------|-----|------|------|
| 操作系统 | ~5% | ~300 MB | ~5 GB |
| Docker 引擎 | ~1% | ~50 MB | ~500 MB |
| Nginx 容器 (AimPad) | ~1% | ~5 MB | ~30 MB（镜像） |
| MySQL 容器 | ~5% | ~300 MB | ~1 GB（数据 + 镜像） |
| Redis 容器 | ~2% | ~100 MB | ~100 MB（镜像） |
| 系统预留 | - | ~500 MB | ~10 GB |
| **可用剩余** | **~86%** | **~2.7 GB** | **~43 GB** |

4C4G 服务器运行全部服务（AimPad + MySQL + Redis）后仍有充裕空间，可用于：
- 后端 API 服务
- 其他项目
- 数据增长

### Docker 镜像大小

| 镜像 | 大小 |
|------|------|
| node:20-alpine（构建阶段） | ~180 MB（不进入最终镜像） |
| nginx:alpine（运行阶段） | ~25 MB |
| AimPad 静态文件 | ~5 MB |
| mysql:8.0 | ~600 MB |
| redis:7-alpine | ~35 MB |
| **全部镜像总计** | **~660 MB** |

---

## 附录 B：常用端口清单

| 端口 | 服务 | 绑定地址 | 访问范围 |
|------|------|----------|----------|
| 22 | SSH | 0.0.0.0 | 公网（可修改端口） |
| 80 | Nginx (AimPad) | 0.0.0.0 | 公网 |
| 443 | HTTPS（扩展时） | 0.0.0.0 | 公网 |
| 3306 | MySQL | 127.0.0.1 | 仅本机 / Docker 内部 |
| 6379 | Redis | 127.0.0.1 | 仅本机 / Docker 内部 |
| 3001 | API 服务（扩展时） | 127.0.0.1 | 仅本机 / Docker 内部 |

---

## 附录 C：后续扩展方向

### C.1 自定义域名 + HTTPS

```
用户 → Caddy (443) → Nginx 容器 (80)
Caddy 自动申请 Let's Encrypt 证书
```

### C.2 添加后端 API

```yaml
# docker-compose.yml 扩展
services:
  aimpad:
    image: ghcr.io/jiangdongshi/aimpad:latest
    ports: ["80:80"]

  api:
    image: ghcr.io/jiangdongshi/aimpad-api:latest
    ports:
      - "127.0.0.1:3001:3001"
    environment:
      DATABASE_URL: mysql://aimpad_user:${MYSQL_PASSWORD}@mysql:3306/aimpad
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - aimpad-net
```

### C.3 CDN 加速

将静态资源托管到 CDN（如 Cloudflare CDN、阿里云 CDN），Nginx 作为回源服务器。

### C.4 多环境部署

```
main 分支   → 生产环境（服务器 A）
dev 分支    → 测试环境（服务器 B）
```

在 GitHub Actions 中通过分支名判断部署目标：

```yaml
on:
  push:
    branches: [main, dev]

jobs:
  deploy:
    steps:
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: ssh ... "cd /opt/aimpad && docker compose pull && docker compose up -d"

      - name: Deploy to staging
        if: github.ref == 'refs/heads/dev'
        run: ssh ... "cd /opt/aimpad-staging && docker compose pull && docker compose up -d"
```

---

**文档版本**：v2.0
**最后更新**：2026-04-30
**维护者**：@jiangdongshi
