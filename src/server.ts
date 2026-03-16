import express, {Response, Request} from 'express';
import { config } from './utils/initconfig.js';
import { logger } from './utils/log.js';
import { createServer } from 'http';
import { WebSocketManager } from './services/wsService.js';
import { httplog } from './middleware/httplog.js';
import { NodeService } from './services/nodeService.js';
import { adminAuth } from './middleware/auth.js';
import createmgr from './router/managerRouter.js';
import { loginRouter } from './router/loginRouter.js';
import ratelimit from 'express-rate-limit';
import { SqliteStore } from 'rate-limit-sqlite';
import path from 'path';
import history from 'connect-history-api-fallback';

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

        const server = createServer(app);
        const wsManager = new WebSocketManager(server);
        NodeService.setWebSocketManager(wsManager);

        // 设置限速
        const limiter = ratelimit({
            windowMs: config.ratelimit.windowMs * 60 * 1000,
            limit: config.ratelimit.limit,
            message: config.ratelimit.message,
            standardHeaders: 'draft-8',
            store: new SqliteStore({
                location: path.resolve('./data', 'app.db'),
                prefix: 'limit'
            })
        });

        // 管理路由
        app.use('/manager', limiter, adminAuth(), createmgr);

        // 登录路由
        app.post('/login', limiter, loginRouter);

        // 把/admin下的所有请求重写到/admin/index.html
        app.use(history({
            index: '/admin/index.html'
        }));
        // 挂载面板静态目录
        app.use('/admin', express.static(path.join(process.cwd(), 'admin')));
        app.use((err: any, _: Request, res: Response) => {
            logger.error({ err }, 'Server error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.use((_, res) => {
        // 404处理
            res.status(404).json({ message: 'Not Fount' });
        });

        // 监听
        server.listen(config.server.port, config.server.addr, () =>
            logger.info(`The web server starts in http://${config.server.addr}:${config.server.port}`)
        );

    } catch (e: any) {
        logger.fatal({ e }, 'Web server failed to start:');
        process.exit(1);
    }
}