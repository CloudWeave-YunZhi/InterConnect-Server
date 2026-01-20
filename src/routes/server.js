const express = require('express');
const router = express.Router();

function createServerRouter(db, manager, requireServerKey) {
    // 获取服务器信息
    router.get('/info', requireServerKey, (req, res) => {
        try {
            // 这里应该从实际的Minecraft服务器获取信息
            // 目前返回模拟数据
            const serverInfo = {
                server_id: req.apiKey.serverId || 'server-001',
                status: 'running',
                online_players: 5,
                max_players: 20,
                version: '1.20.1',
                uptime: '2h 30m',
                tps: 19.8
            };
            
            res.json(serverInfo);
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    // 发送服务器命令
    router.post('/command', requireServerKey, (req, res) => {
        try {
            const { command } = req.body;
            
            if (!command) {
                return res.status(400).json({ detail: 'Command is required' });
            }
            
            // 这里应该向实际的Minecraft服务器发送命令
            // 目前只是记录命令
            console.log(`[Server Command] ${req.apiKey.serverId}: ${command}`);
            
            // 广播命令执行事件
            const commandEvent = {
                event_type: 'server_command',
                server_name: req.apiKey.serverId || 'unknown',
                timestamp: new Date().toISOString(),
                data: {
                    command: command,
                    executed_by: req.apiKey.id,
                    server_id: req.apiKey.serverId
                }
            };
            
            manager.broadcastToAll({
                type: 'minecraft_event',
                event: commandEvent,
                source_key_id_prefix: req.apiKey.id.substring(0, 8)
            });
            
            res.json({ 
                message: 'Command sent successfully',
                command: command,
                server_id: req.apiKey.serverId
            });
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    return router;
}

module.exports = createServerRouter;