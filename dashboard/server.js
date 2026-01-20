require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || '3000');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🎮 Minecraft WebSocket API - 控制面板');
    console.log('='.repeat(50));
    console.log(`控制面板地址: http://localhost:${PORT}`);
    console.log('请使用SuperKey登录');
    console.log('='.repeat(50));
});
