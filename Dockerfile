# Hugging Face Spaces Docker 部署（免费套餐端口固定 7860）
FROM node:20-slim

WORKDIR /app

# 先装依赖（利用 Docker 缓存）
COPY package.json package-lock.json ./
RUN npm install

# 拷贝源码并构建（前端 dist/public + 后端 dist/boot.js）
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "start"]
