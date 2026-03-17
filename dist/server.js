import express from 'express';
import { config } from './utils/initconfig.js';
import { logger } from './utils/log.js';
import { createServer } from 'http';
import { WebSocketManager } from './services/wsService.js';
import { httplog } from './middleware/httplog.js';
import { createNodeService } from './services/nodeService.js';
import { adminAuth } from './middleware/auth.js';
import createmgr from './router/managerRouter.js';
import adminPanelRouter from './router/adminPanelRouter.js';
import { loginRouter } from './router/loginRouter.js';
import { limiter } from './middleware/rateLimit.js';
export const app = express();
const server = createServer(app);
const wsManager = new WebSocketManager(server);
export const NodeService = createNodeService(wsManager);
let started = false;
export async function startServer() {
    if (started)
        return;
    try {
        app.set('trust proxy', 1);
        app.use(httplog);
        app.use(express.json());
        app.use('/manager', limiter, adminAuth(), createmgr);
        app.post('/login', limiter, loginRouter);
        app.use('/admin', adminPanelRouter);
        app.use((err, _, res) => {
            logger.error({ err }, 'Server error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        app.use((_, res) => {
            res.status(404).json({ message: 'Not Fount' });
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(config.server.port, config.server.addr, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    logger.info(`The web server starts in http://${addr.address}:${addr.port}`);
                }
                else {
                    logger.info(`The web server starts in http://${config.server.addr}:${config.server.port}`);
                }
                started = true;
                resolve();
            });
        });
    }
    catch (e) {
        logger.fatal({ e }, 'Web server failed to start:');
        process.exit(1);
    }
}
export async function stopServer() {
    if (!started)
        return;
    wsManager.destroy();
    await new Promise((resolve, reject) => {
        server.close((err) => {
            if (err)
                return reject(err);
            started = false;
            resolve();
        });
    });
}
export function getHttpServer() {
    return server;
}
//# sourceMappingURL=server.js.map