import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../utils/initdatabase.js';
import { logger } from '../utils/log.js';
import { verifyNode } from './wsAuth.js';
export class WebSocketManager {
    wss;
    activeNodes = new Map();
    setNodeOnline = db.prepare('UPDATE nodes SET stat = 1 WHERE uuid = ?');
    setNodeOffline = db.prepare('UPDATE nodes SET stat = 0 WHERE uuid = ?');
    EVENTS = new Set(['player_join', 'player_quit', 'player_death', 'player_chat', 'player_message']);
    heartbeatInterval;
    constructor(server) {
        this.wss = new WebSocketServer({ noServer: true });
        this.setupWebSocket();
        this.setupUpgrade(server);
    }
    setupWebSocket() {
        this.heartbeatInterval = setInterval(() => {
            this.activeNodes.forEach((ws, uuid) => {
                if (ws.isAlive === false) {
                    logger.warn({ uuid, name: ws.servername }, 'Node heartbeat timeout, terminating...');
                    this.activeNodes.delete(uuid);
                    this.setNodeOnline.run(uuid);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
                ws.send(JSON.stringify({
                    type: 'heartbeat',
                    time: Date.now(),
                    msg: { status: 'ping' }
                }));
            });
        }, 30000);
        this.wss.on('connection', (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            const uuid = req.headers['x-uuid'];
            const token = req.headers['x-token'];
            if (!uuid || !token) {
                logger.warn({ ip: clientIp }, 'WS rejected – missing x-uuid or x-token header');
                ws.close(1008, 'Unauthorized');
                return;
            }
            const node = verifyNode(uuid, token);
            if (!node) {
                logger.warn({ ip: clientIp, uuid }, 'WS rejected – invalid uuid or token');
                ws.close(1008, 'Unauthorized');
                return;
            }
            if (this.activeNodes.has(uuid)) {
                logger.warn({ uuid, ip: clientIp }, 'WS rejected – uuid already connected');
                ws.close(1008, 'Already connected');
                return;
            }
            ws.isAlive = true;
            ws.uuid = uuid;
            ws.servername = node.servername;
            this.activeNodes.set(uuid, ws);
            this.setNodeOnline.run(uuid);
            logger.info({ uuid, name: node.servername, ip: clientIp }, 'Node connected');
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            ws.on('message', (rawData) => {
                ws.isAlive = true;
                try {
                    const packet = JSON.parse(rawData.toString());
                    const { type, targetId, msg } = packet;
                    if (!this.EVENTS.has(type))
                        return;
                    const forwardData = JSON.stringify({
                        fromId: ws.uuid,
                        fromName: ws.servername,
                        type,
                        msg,
                        time: Date.now(),
                    });
                    if (targetId === 'all') {
                        const targets = [];
                        this.activeNodes.forEach((node, id) => {
                            if (id !== ws.uuid && node.readyState === WebSocket.OPEN) {
                                node.send(forwardData);
                                targets.push(id);
                            }
                        });
                        logger.info({ from: ws.servername, type, data: msg, targets }, 'WS broadcast');
                    }
                    else if (this.activeNodes.has(targetId)) {
                        this.activeNodes.get(targetId)?.send(forwardData);
                        logger.info({ from: ws.servername, to: targetId, type, data: msg }, 'WS forward');
                    }
                }
                catch (err) {
                    logger.error({ err }, 'WS message parse error');
                }
            });
            ws.on('close', () => {
                this.activeNodes.delete(ws.uuid);
                this.setNodeOffline.run(ws.uuid);
                logger.info({ uuid: ws.uuid, name: ws.servername }, 'Node disconnected');
            });
            ws.on('error', (err) => {
                logger.error({ err, uuid: ws.uuid }, 'WS socket error');
            });
        });
        this.wss.on('close', () => {
            clearInterval(this.heartbeatInterval);
        });
    }
    setupUpgrade(server) {
        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host}`);
            if (url.pathname === '/ws') {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            }
            else {
                socket.destroy();
            }
        });
    }
    kickNodeByServername(servername) {
        let targetUuid = null;
        for (const [uuid, ws] of this.activeNodes.entries()) {
            if (ws.servername === servername) {
                targetUuid = uuid;
                break;
            }
        }
        if (targetUuid) {
            const ws = this.activeNodes.get(targetUuid);
            if (ws) {
                ws.terminate();
                this.activeNodes.delete(targetUuid);
                this.setNodeOffline.run(targetUuid);
                logger.info({ servername, uuid: targetUuid }, 'Old node connection kicked');
                return true;
            }
        }
        return false;
    }
    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.wss.close();
    }
}
//# sourceMappingURL=wsService.js.map