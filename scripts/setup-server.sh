#!/bin/bash
# ============================================
# 服务器初始化脚本（首次部署时运行一次）
# 用法: bash setup-server.sh
# ============================================
set -e

DEPLOY_PATH="/opt/aimpad"
REPO_URL="https://github.com/jiangdongshi/AimPad.git"

echo "=========================================="
echo "  AimPad 服务器初始化"
echo "=========================================="

# 1. 安装 Docker
if ! command -v docker &> /dev/null; then
    echo "==> 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker 安装完成"
else
    echo "Docker 已安装，跳过"
fi

# 2. 安装 Docker Compose（新版自带 compose 子命令，检查旧版兼容）
if ! docker compose version &> /dev/null; then
    echo "==> 安装 Docker Compose 插件..."
    mkdir -p ~/.docker/cli-plugins/
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o ~/.docker/cli-plugins/docker-compose
    chmod +x ~/.docker/cli-plugins/docker-compose
    echo "Docker Compose 安装完成"
else
    echo "Docker Compose 已安装，跳过"
fi

# 3. 创建部署目录
echo "==> 创建部署目录: $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH"

# 4. 复制 docker-compose.yml 到部署目录
# 如果是从项目目录运行，直接复制
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
    cp "$PROJECT_DIR/docker-compose.yml" "$DEPLOY_PATH/docker-compose.yml"
    echo "已复制 docker-compose.yml"
else
    echo "==> 从 GitHub 下载 docker-compose.yml..."
    curl -fsSL "https://raw.githubusercontent.com/jiangdongshi/AimPad/main/docker-compose.yml" \
        -o "$DEPLOY_PATH/docker-compose.yml"
fi

# 5. 复制部署脚本
if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
    cp "$SCRIPT_DIR/deploy.sh" "$DEPLOY_PATH/deploy.sh"
    chmod +x "$DEPLOY_PATH/deploy.sh"
    echo "已复制 deploy.sh"
fi

# 6. 登录 GHCR（需要 token）
echo ""
echo "=========================================="
echo "  请手动登录 GHCR 以拉取私有镜像："
echo "  docker login swr.cn-north-4.myhuaweicloud.com -u <SWR_USERNAME>"
echo "=========================================="
echo ""

# 7. 首次拉取并启动
echo "==> 首次拉取镜像并启动..."
cd "$DEPLOY_PATH"
docker compose pull
docker compose up -d

echo ""
echo "=========================================="
echo "  初始化完成!"
echo "  部署目录: $DEPLOY_PATH"
echo "  访问: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "=========================================="
