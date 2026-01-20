#!/bin/bash

echo "🚀 启动Minecraft WebSocket API服务器..."
echo "=================================================="

if [ ! -d "node_modules" ]; then
    echo "📦 检测到缺少依赖，正在安装..."
    npm install
fi

node src/server.js
