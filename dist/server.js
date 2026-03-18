import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import { createServer } from 'http';
import { httplog } from './middleware/httplog.js';
import createmgr from './router/managerRouter.js';
import loginRouter from './router/loginRouter.js';
import { createNodeService } from './services/nodeService.js';
import { WebSocketManager } from './services/wsService.js';
import { config } from './utils/initconfig.js';
import { logger } from './utils/log.js';
export const app = new Koa();
const server = createServer(app.callback());
const wsManager = new WebSocketManager(server);
export const NodeService = createNodeService(wsManager);
let started = false;
export async function startServer() {
    if (started)
        return;
    try {
        app.use(async (ctx, next) => {
            try {
                await next();
            }
            catch (error) {
                ctx.status = 500;
                ctx.body = { error: 'Internal server error' };
                logger.error({ err: error }, 'Error processing request');
                console.debug(ctx.request.body);
            }
        });
        app.proxy = true;
        app.use(bodyParser());
        app.use(httplog);
        app.use(createmgr.routes());
        app.use(createmgr.allowedMethods());
        app.use(loginRouter.routes());
        app.use(loginRouter.allowedMethods());
        app.use(async (ctx) => {
            ctx.status = 404;
            ctx.body = { error: '404 Not Found' };
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