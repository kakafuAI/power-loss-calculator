# ============================================
# 功率器件损耗计算工具 - Docker 多阶段构建
# ============================================

# ---- Stage 1: 构建前端 ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Python 后端 ----
FROM python:3.11-slim
WORKDIR /app

# 安装系统依赖（pdfplumber 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制构建好的前端
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 暴露端口
EXPOSE 8000

# 启动
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
