#!/bin/bash
# ============================================
# 服务器端手动部署脚本
# 用法: bash /opt/aimpad/deploy.sh
# ============================================
set -e

DEPLOY_PATH="/opt/aimpad"
IMAGE="swr.cn-north-4.myhuaweicloud.com/aimpad/aimpad:latest"

echo "==> 进入部署目录: $DEPLOY_PATH"
cd "$DEPLOY_PATH"

echo "==> 拉取最新镜像..."
docker compose pull

echo "==> 启动容器..."
docker compose up -d --remove-orphans

echo "==> 清理旧镜像..."
docker image prune -f

echo "==> 部署完成!"
docker compose ps
