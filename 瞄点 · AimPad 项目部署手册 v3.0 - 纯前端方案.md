# 瞄点 · AimPad 项目部署手册 v3.0 — 纯前端方案

> **版本变更**：v3.0 彻底简化部署。项目变为纯静态 SPA，无需 Docker Compose、MySQL、Redis、后端 API。本文档替代旧版部署手册和 CI/CD 手册中所有涉及服务端部署的内容。

## 目录

- [1. 概述](#1-概述)
- [2. 方案 A：Vercel 部署（推荐，免费）](#2-方案-avercel-部署推荐免费)
- [3. 方案 B：Cloudflare Pages 部署（推荐，免费）](#3-方案-bcloudflare-pages-部署推荐免费)
- [4. 方案 C：Nginx 自建服务器部署](#4-方案-cnginx-自建服务器部署)
- [5. 方案 D：GitHub Pages（免费）](#5-方案-dgithub-pages免费)
- [6. CI/CD（可选）](#6-cicd可选)
- [7. 域名与 HTTPS](#7-域名与-https)
- [8. 环境变量](#8-环境变量)
- [9. 故障排查](#9-故障排查)

---

## 1. 概述

### 1.1 架构变化

```
v3.2 部署架构（旧）：
  构建 → 推送 Docker 镜像到 SWR → SSH 触发服务器 → docker compose up
  ├── Nginx 容器（前端）
  ├── API 容器（Express:3001）
  ├── MySQL 容器（:3306）
  └── Redis 容器（:6379）

v3.0 部署架构（新）：
  构建 → 上传 dist/ → 静态托管服务
  └── 就是一堆 HTML/JS/CSS 文件
```

### 1.2 推荐方案

| 方案 | 费用 | 速度 | 适用场景 |
|------|------|------|----------|
| **Vercel** | 免费 | CDN 全球加速 | 首选 |
| **Cloudflare Pages** | 免费 | CDN 全球加速 | 需要更多带宽 |
| **Nginx** | 仅服务器费用 | 取决于服务器 | 自建服务器 |
| **GitHub Pages** | 免费 | CDN | 最简单 |

---

## 2. 方案 A：Vercel 部署（推荐，免费）

### 2.1 一键部署

1. 将项目推送到 GitHub
2. 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
3. 点击 "New Project" → 选择 AimPad 仓库
4. Vercel 自动检测 Vite 项目，无需配置
5. 点击 "Deploy"

### 2.2 手动部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 在项目根目录运行
vercel

# 生产部署
vercel --prod
```

### 2.3 vercel.json（可选）

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> `rewrites` 配置确保 SPA 路由正常（/training、/statistics 等路径刷新不会 404）。

### 2.4 免费额度

- 带宽：100 GB / 月
- 构建次数：6000 分钟 / 月
- 自定义域名：支持
- 自动 HTTPS：支持

---

## 3. 方案 B：Cloudflare Pages 部署（推荐，免费）

### 3.1 部署步骤

1. 将项目推送到 GitHub
2. 访问 Cloudflare Dashboard → Workers & Pages
3. 创建 Pages 项目 → 连接 GitHub 仓库
4. 构建设置：
   - **Framework preset**：Vite
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
5. 点击 "Save and Deploy"

### 3.2 免费额度

- 带宽：无限
- 构建次数：500 次 / 月
- 自定义域名：支持
- 自动 HTTPS：支持

---

## 4. 方案 C：Nginx 自建服务器部署

### 4.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核 |
| 内存 | 512 MB | 1 GB |
| 存储 | 10 GB | 20 GB |
| 系统 | Ubuntu 22.04 / Debian 12 | — |

### 4.2 部署步骤

**服务器上：**

```bash
# 安装 Nginx
sudo apt update && sudo apt install nginx -y

# 创建部署目录
sudo mkdir -p /var/www/aimpad

# 上传 dist/ 内容到此目录
# （本地执行）
scp -r dist/* user@your-server:/var/www/aimpad/
```

**Nginx 配置（`/etc/nginx/sites-available/aimpad`）：**

```nginx
server {
    listen 80;
    server_name aimpad.example.com;

    root /var/www/aimpad;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    # SPA 路由：所有路径返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/aimpad /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4.3 自动部署脚本

**deploy.sh**（在服务器上运行）：

```bash
#!/bin/bash
set -e

REPO_DIR="/opt/aimpad"
WEB_ROOT="/var/www/aimpad"

cd "$REPO_DIR"
git pull origin main
npm install
npm run build
sudo rm -rf "$WEB_ROOT"/*
sudo cp -r dist/* "$WEB_ROOT"/
echo "Deployed at $(date)"
```

### 4.4 Docker 部署（Nginx 容器）

**Dockerfile**：

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**：

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
docker build -t aimpad .
docker run -d -p 8080:80 aimpad
```

---

## 5. 方案 D：GitHub Pages（免费）

### 5.1 部署步骤

1. 在 GitHub 仓库 Settings → Pages
2. Source：GitHub Actions
3. 创建工作流文件 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: './dist' }
      - uses: actions/deploy-pages@v4
```

---

## 6. CI/CD（可选）

如果使用自建 Nginx 服务器，可用 GitHub Actions 自动部署：

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npm run build
      - name: Deploy to server
        uses: easingthemes/ssh-deploy@v4
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          ARGS: "-rltgoDzvO --delete"
          SOURCE: "dist/"
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          TARGET: "/var/www/aimpad"
```

**GitHub Secrets 配置：**

| Secret | 说明 |
|--------|------|
| `SSH_PRIVATE_KEY` | 服务器 SSH 私钥 |
| `REMOTE_HOST` | 服务器 IP |
| `REMOTE_USER` | SSH 用户名 |

---

## 7. 域名与 HTTPS

### 7.1 自定义域名

所有四种方案均支持自定义域名：
- **Vercel**：Settings → Domains → 添加域名
- **Cloudflare Pages**：Custom domains → 添加域名
- **Nginx**：使用 certbot 配置 Let's Encrypt
- **GitHub Pages**：Settings → Pages → Custom domain

### 7.2 Nginx + Let's Encrypt HTTPS

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx -y

# 自动配置 HTTPS
sudo certbot --nginx -d aimpad.example.com

# 自动续期（certbot 默认已配置）
sudo certbot renew --dry-run
```

---

## 8. 环境变量

### 8.1 Vite 环境变量

创建 `.env.production`：

```bash
# .env.production
VITE_APP_NAME=瞄点 · AimPad
VITE_APP_VERSION=4.0.0
```

在代码中使用：
```typescript
const appName = import.meta.env.VITE_APP_NAME;
```

> v4.0 不再需要 `VITE_API_URL`——因为没有后端 API。

---

## 9. 故障排查

### Q1: 刷新页面后出现 404

**原因**：SPA 路由未正确配置回退。

**解决**：确保静态服务器配置了 `try_files $uri /index.html`（Nginx）或 `rewrites`（Vercel）。

### Q2: 构建失败

```bash
# 检查 TypeScript 错误
npx tsc --noEmit

# 清除缓存重试
rm -rf node_modules dist
npm install
npm run build
```

### Q3: Vercel 部署后路由不工作

添加 `vercel.json`：
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Q4: 静态资源 404

**原因**：`base` 路径配置错误。

**解决**：如果部署到子路径（如 `example.com/aimpad/`），在 `vite.config.ts` 中设置：
```typescript
export default defineConfig({
  base: '/aimpad/',
});
```

---

**文档版本**：v3.0
**最后更新**：2026-06-16
**维护者**：@jiangdongshi
