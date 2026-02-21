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

        ws.on('pong', () => { ws.isAlive = true; });

        // --- Messages ---
        ws.on('message', (rawData) => {
            try {
                const packet = JSON.parse(rawData.toString());
                const { type, targetId, msg } = packet;

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
    });
}
/**
 * 强制踢出指定 servername 的节点
 */
export function kickNodeByServername(servername: string): boolean {
    let targetUuid: string | null = null;

    // 遍历当前的在线列表
    for (const [uuid, ws] of activeNodes.entries()) {
        if (ws.servername === servername) {
            targetUuid = uuid;
            break; 
        }
    }

    if (targetUuid) {
        const ws = activeNodes.get(targetUuid);
        if (ws) {
            ws.terminate(); // 暴力切断
            activeNodes.delete(targetUuid);
            setNodeOffline.run(targetUuid);
            logger.info({ servername, uuid: targetUuid }, 'Old node connection kicked before key update');
            return true;
        }
    }
    
    return false; // 不在线，直接跳过
}