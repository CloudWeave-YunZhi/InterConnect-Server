import express, { Response, Request } from 'express';
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

/**
 * 启动服务并挂载路由和 WebSocket
 */
export async function startServer(): Promise<void> {
    if (started) return;

    try {
        app.set('trust proxy', 1);
        app.use(httplog);

        app.use(express.json());

        // 管理路由
        app.use('/manager', limiter, adminAuth(), createmgr);

        // 登录路由
        app.post('/login', limiter, loginRouter);

        // 挂载 admin SPA 面板路由
        app.use('/admin', adminPanelRouter);

        app.use((err: any, _: Request, res: Response) => {
            logger.error({ err }, 'Server error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.use((_, res) => {
            // 404 处理
            res.status(404).json({ message: 'Not Fount' });
        });

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(config.server.port, config.server.addr, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    logger.info(`The web server starts in http://${addr.address}:${addr.port}`);
                } else {
                    logger.info(`The web server starts in http://${config.server.addr}:${config.server.port}`);
                }
                started = true;
                resolve();
            });
        });
    } catch (e: any) {
        logger.fatal({ e }, 'Web server failed to start:');
        process.exit(1);
    }
}

export async function stopServer(): Promise<void> {
    if (!started) return;

    wsManager.destroy();
    await new Promise<void>((resolve, reject) => {
        server.close((err) => {
            if (err) return reject(err);
            started = false;
            resolve();
        });
    });
}

export function getHttpServer() {
    return server;
}
