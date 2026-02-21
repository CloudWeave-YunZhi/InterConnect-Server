import express, {Response, Request, NextFunction} from 'express';
import { config } from '../utils/initconfig.js';
import { logger } from '../utils/log.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket.js';
import { httplog } from './middleware/httplog.js';
import { createRouters } from './routers.js';
import path from 'path';

export const app = express();

/**
 * 启动服务器并挂载路由与 WebSocket
 * @returns {Promise<void>}
 */
export async function startServer(): Promise<void> {
    try {
        app.set('trust proxy', 1);
        httplog();
        
        app.use(express.json()); 
        // 设置ws.jpg
        const server = createServer(app);
        const wss = new WebSocketServer({ noServer: true });
        setupWebSocket(wss);

        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url!, `http://${request.headers.host}`);
            
            if (url.pathname === '/ws') {
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        });
        // 挂载路由.jpg
        createRouters();

        app.use('/admin', express.static(path.join(process.cwd(), 'admin')));
        app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            logger.error({ err }, 'Server error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.use((req, res) => {
        // 404处理
            res.status(404).json({ message: 'Not Fount' });
        });

        // 监听.jpg
        server.listen(config.server.port, config.server.addr, () =>
            logger.info(`The web server starts in http://${config.server.addr}:${config.server.port}`)
        );

    } catch (e: any) {
        logger.fatal({ e }, 'Web server failed to start:');
        process.exit(1);
    }
}