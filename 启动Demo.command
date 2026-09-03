#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

cd "$SCRIPT_DIR/runtime" || exit 1
echo "正在启动 Kooky Demo..."
"$SCRIPT_DIR/runtime/KookyDemoServer-macOS" >/tmp/kooky-demo-serve.log 2>&1 &
SERVER_PID=$!
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  cat /tmp/kooky-demo-serve.log
  read -k 1 "?启动失败，按任意键退出..."
  exit 1
fi

open "http://localhost:$PORT/super-assistant/"
echo "Demo 已打开：http://localhost:$PORT/super-assistant/"
echo "保持此窗口打开；关闭窗口即可停止 Demo 服务。"
wait "$SERVER_PID"
