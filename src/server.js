require('dotenv').config();
const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const Database = require('./database');
const ConnectionManager = require('./websocket');
const { verifyApiKey, requireAdminKey, requireServerKey, requireAnyKey } = require('./auth');
const createKeysRouter = require('./routes/keys');
const createEventsRouter = require('./routes/events');
const createHealthRouter = require('./routes/health');
const createServerRouter = require('./routes/server');

const HOST = process.env.SERVER_HOST || '0.0.0.0';
const PORT = parseInt(process.env.SERVER_PORT || '8000');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const db = new Database(process.env.DATABASE_PATH || 'minecraft_ws.db');
const manager = new ConnectionManager();

app.use(express.json());

app.use('/dashboard', express.static(path.join(__dirname, '../dashboard/public')));

app.get('/', (req, res) => {
    res.json({
        message: 'Minecraft WebSocket API Server (Node.js)',
        dashboard: '/dashboard',
        websocket: 'ws://' + req.get('host') + '/ws',
        version: '1.0.0'
    });
});

app.use('/manage/keys', verifyApiKey(db), requireAdminKey, createKeysRouter(db, requireAdminKey));
app.use('/api/events', verifyApiKey(db), requireAnyKey, createEventsRouter(db, manager, requireAnyKey));
app.use('/health', createHealthRouter(db, manager));

server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    if (url.pathname === '/ws') {
        const apiKey = url.searchParams.get('api_key');
        
        if (!apiKey) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        
        const result = await db.verifyApiKey(apiKey);
        
        if (!result) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, result);
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws, request, apiKeyInfo) => {
    manager.connect(ws, apiKeyInfo.id);
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
        }
    });
    
    ws.on('close', () => {
        manager.disconnect(ws);
    });
    
    ws.on('error', () => {
        manager.disconnect(ws);
    });
});

async function startServer() {
    console.log('🚀 启动Minecraft WebSocket API服务器...');
    console.log('='.repeat(50));
    
    await db.init();
    
    const adminKeyInfo = await db.ensureInitialAdminKey();
    
    if (adminKeyInfo) {
        console.log('='.repeat(60));
        console.log('重要: 已生成新的Admin Key!');
        console.log(`  名称: ${adminKeyInfo.name}`);
        console.log(`  密钥: ${adminKeyInfo.key}`);
        console.log('请复制并安全保存此密钥。');
        console.log('您需要使用它来管理API密钥。');
        console.log('如果丢失此密钥且没有其他Admin Key，您可能失去管理员访问权限。');
        console.log('='.repeat(60));
    } else {
        console.log('信息: 已找到现有Admin Key或Admin Key检查已执行。');
    }
    
    server.listen(PORT, HOST, () => {
        console.log(`服务器地址: http://${HOST}:${PORT}`);
        console.log(`WebSocket端点: ws://${HOST}:${PORT}/ws`);
        console.log(`健康检查: http://${HOST}:${PORT}/health`);
        console.log('='.repeat(50));
        console.log();
        console.log('💡 首次使用提示:');
        console.log('1. 使用CLI工具创建API密钥:');
        console.log('   node cli/cli.js create-key "MyServer"');
        console.log();
        console.log('2. 生成Minecraft插件配置文件:');
        console.log('   node cli/cli.js generate-config');
        console.log();
        console.log('3. 将API密钥配置到Minecraft插件中');
        console.log('='.repeat(50));
    });
}

startServer().catch(error => {
    console.error('❌ 启动失败:', error);
    process.exit(1);
});
