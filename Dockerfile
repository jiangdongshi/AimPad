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
