import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { db } from '../database/initdatabase.js';
import { logger } from '../utils/log.js';
import { verifyNode } from './wsauth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
    uuid: string;
    servername: string;
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const activeNodes    = new Map<string, ExtWebSocket>();
const setNodeOnline  = db.prepare('UPDATE nodes SET stat = 1 WHERE uuid = ?');
const setNodeOffline = db.prepare('UPDATE nodes SET stat = 0 WHERE uuid = ?');

const EVENTS = new Set(['player_join', 'player_quit', 'player_death', 'player_chat', 'player_message']);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function setupWebSocket(wss: WebSocketServer): void {
    
    /**
     * 心跳保活定时器
     * 每 30 秒探测一次所有连接的节点
     */
    const heartbeatInterval = setInterval(() => {
        activeNodes.forEach((ws, uuid) => {
            if (ws.isAlive === false) {
                logger.warn({ uuid, name: ws.servername }, 'Node heartbeat timeout, terminating...');
                // 如果节点在 30 秒内没有任何响应，则强制断开并清理
                activeNodes.delete(uuid);
                setNodeOnline.run(uuid); // 确保数据库状态更新
                return ws.terminate();
            }

            // 先标记为假，等待客户端响应来重置
            ws.isAlive = false;

            // 1. 发送协议层 Ping (标准 WebSocket 行为)
            ws.ping();

            // 2. 发送业务层心跳包 (适配 Java 插件的 onMessage 逻辑)
            // 插件收到此 JSON 后会触发 onMessage，从而将插件侧的 isAlive 设为 true
            ws.send(JSON.stringify({
                type: 'heartbeat',
                time: Date.now(),
                msg: { status: 'ping' }
            }));
        });
    }, 30000);

    wss.on('connection', (ws: ExtWebSocket, req: IncomingMessage) => {
        const clientIp = req.socket.remoteAddress;

        // --- Auth ---
        const uuid  = req.headers['x-uuid'] as string | undefined;
        const token = req.headers['x-token'] as string | undefined;

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

        // --- Conflict check ---
        if (activeNodes.has(uuid)) {
            logger.warn({ uuid, ip: clientIp }, 'WS rejected – uuid already connected');
            ws.close(1008, 'Already connected');
            return;
        }

        // --- Bind ---
        ws.isAlive    = true;
        ws.uuid       = uuid;
        ws.servername = node.servername;
        activeNodes.set(uuid, ws);
        setNodeOnline.run(uuid);

        logger.info({ uuid, name: node.servername, ip: clientIp }, 'Node connected');

        // 监听 Pong 响应
        ws.on('pong', () => { 
            ws.isAlive = true; 
        });

        // --- Messages ---
        ws.on('message', (rawData) => {
            // 收到任何消息说明客户端还活着
            ws.isAlive = true;

            try {
                const packet = JSON.parse(rawData.toString());
                const { type, targetId, msg } = packet;

                // 过滤掉不属于业务事件的消息（如客户端发回的心跳响应）
                if (!EVENTS.has(type)) return;

                const forwardData = JSON.stringify({
                    fromId:   ws.uuid,
                    fromName: ws.servername,
                    type,
                    msg,
                    time: Date.now(),
                });

                if (targetId === 'all') {
                    const targets: string[] = [];
                    activeNodes.forEach((node, id) => {
                        if (id !== ws.uuid && node.readyState === WebSocket.OPEN) {
                            node.send(forwardData);
                            targets.push(id);
                        }
                    });
                    logger.info({ from: ws.servername, type, data: msg, targets }, 'WS broadcast');
                } else if (activeNodes.has(targetId)) {
                    activeNodes.get(targetId)?.send(forwardData);
                    logger.info({ from: ws.servername, to: targetId, type, data: msg }, 'WS forward');
                }

            } catch (err) {
                logger.error({ err }, 'WS message parse error');
            }
        });

        // --- Disconnect ---
        ws.on('close', () => {
            activeNodes.delete(ws.uuid);
            setNodeOffline.run(ws.uuid);
            logger.info({ uuid: ws.uuid, name: ws.servername }, 'Node disconnected');
        });

        ws.on('error', (err) => {
            logger.error({ err, uuid: ws.uuid }, 'WS socket error');
        });
    });

    // 当 WSS 关闭时清理定时器
    wss.on('close', () => {
        clearInterval(heartbeatInterval);
    });
}

/**
 * 强制踢出指定 servername 的节点
 */
export function kickNodeByServername(servername: string): boolean {
    let targetUuid: string | null = null;

    for (const [uuid, ws] of activeNodes.entries()) {
        if (ws.servername === servername) {
            targetUuid = uuid;
            break; 
        }
    }

    if (targetUuid) {
        const ws = activeNodes.get(targetUuid);
        if (ws) {
            ws.terminate(); 
            activeNodes.delete(targetUuid);
            setNodeOffline.run(targetUuid);
            logger.info({ servername, uuid: targetUuid }, 'Old node connection kicked');
            return true;
        }
    }
    
    return false;
}