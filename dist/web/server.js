import express from 'express';
import { config } from '../utils/initconfig.js';
import { logger } from '../utils/log.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket.js';
import { httplog } from './middleware/httplog.js';
import { createRouters } from './routers.js';
import path from 'path';
import history from 'connect-history-api-fallback';
export const app = express();
export async function startServer() {
    try {
        app.set('trust proxy', 1);
        httplog();
        app.use(express.json());
        const server = createServer(app);
        const wss = new WebSocketServer({ noServer: true });
        setupWebSocket(wss);
        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host}`);
            if (url.pathname === '/ws') {
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request);
                });
            }
            else {
                socket.destroy();
            }
        });
        createRouters();
        app.use(history({
            index: '/admin/index.html'
        }));
        app.use('/admin', express.static(path.join(process.cwd(), 'admin')));
        app.use((err, req, res, next) => {
            logger.error({ err }, 'Server error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        app.use((req, res) => {
            res.status(404).json({ message: 'Not Fount' });
        });
        server.listen(config.server.port, config.server.addr, () => logger.info(`The web server starts in http://${config.server.addr}:${config.server.port}`));
    }
    catch (e) {
        logger.fatal({ e }, 'Web server failed to start:');
        process.exit(1);
    }
}
//# sourceMappingURL=server.js.map