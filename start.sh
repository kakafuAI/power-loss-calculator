#!/bin/bash
# Power Loss Calculator - Startup Script
# Starts both backend and frontend servers

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Power Loss Calculator ==="
echo ""

# Start backend
echo "[1/2] Starting backend (FastAPI on port 8000)..."
cd "$SCRIPT_DIR/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "  Backend ready."
else
    echo "  ERROR: Backend failed to start."
    exit 1
fi

# Start frontend
echo "[2/2] Starting frontend (Vite on port 5173)..."
cd "$SCRIPT_DIR/frontend"
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "=== Application running ==="
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
