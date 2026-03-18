import Router from '@koa/router';
import { NodeService } from '../server.js';
import { limiter } from '../middleware/rateLimit.js';
import { adminAuth } from '../middleware/auth.js';

const router = new Router({prefix: '/manager'});
router.use(limiter);
router.use(adminAuth);
router.get('/keys', (ctx) => {
    ctx.body = NodeService.getKeys();
});

router.post('/keys/:servername', (ctx) => {
    ctx.status = 201;
    ctx.body = NodeService.createKey(ctx.params.servername);
});

router.delete('/keys/:servername', (ctx) => {
    ctx.body = NodeService.deleteKey(ctx.params.servername);
});

router.post('/kick/:servername', (ctx) => {
    ctx.body = NodeService.kickNode(ctx.params.servername);
});

export default router;
