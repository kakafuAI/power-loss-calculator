#!/bin/bash
# =============================================
# 功率器件损耗计算工具 — 部署脚本
# 单端口部署 (FastAPI 同时托管前端静态文件)
# 局域网可通过 http://<IP>:8000 访问
# =============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "  功率器件损耗计算工具 - 部署"
echo "======================================"

# 1. 构建前端
echo ""
echo "[1/3] 构建前端..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
echo "  ✅ 前端构建完成"

# 2. 启动后端
echo ""
echo "[2/3] 启动后端服务 (端口 8000)..."
cd "$SCRIPT_DIR/backend"

# 激活虚拟环境（如果有）
if [ -d "venv" ]; then
    source venv/bin/activate 2>/dev/null || true
fi

# 检查依赖
python3 -c "import fastapi, uvicorn" 2>/dev/null || {
    echo "  ⚠️  安装 Python 依赖..."
    pip install -r requirements.txt
}

# 后台启动
cd "$SCRIPT_DIR/backend"
nohup python3 -m uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 \
    --workers 2 \
    > "$SCRIPT_DIR/deploy.log" 2>&1 &

BACKEND_PID=$!
echo "  ✅ 后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端就绪
sleep 2
for i in $(seq 1 10); do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "  ✅ 后端服务就绪"
        break
    fi
    sleep 1
done

# 3. 获取局域网 IP
echo ""
echo "[3/3] 获取网络信息..."
IP=""
# 尝试获取 WSL / Linux IP
if command -v ip &>/dev/null; then
    IP=$(ip addr show eth0 2>/dev/null | grep -oP 'inet \K[\d.]+' || true)
fi
if [ -z "$IP" ]; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$IP" ]; then
    IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K[\d.]+' || echo "127.0.0.1")
fi

echo ""
echo "======================================"
echo "  ✅ 部署完成！"
echo "======================================"
echo ""
echo "  局域网访问 (LAN):"
echo "    http://$IP:8000"
echo ""
echo "  本机访问:"
echo "    http://localhost:8000"
echo ""
echo "  API 文档:"
echo "    http://localhost:8000/docs"
echo ""
echo "  停止服务:"
echo "    kill $BACKEND_PID"
echo ""
echo "  日志文件:"
echo "    $SCRIPT_DIR/deploy.log"
echo "======================================"
echo ""
echo "PID=$BACKEND_PID" > "$SCRIPT_DIR/.deploy.pid"
