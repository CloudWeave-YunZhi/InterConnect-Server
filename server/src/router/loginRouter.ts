import type { Context } from 'koa';
import Router from '@koa/router';
import { db } from '../utils/initdatabase.js';
import { createSession, safeVerify } from '../middleware/auth.js';

const router = new Router();

router.post('/login', async (ctx: Context) => {
    if (!ctx.request.body || typeof ctx.request.body !== 'object') {
        ctx.status = 400;
        ctx.body = { success: false, error: 'Invalid JSON body' };
        return;
    }

    const { password } = ctx.request.body as { password?: string };
    if (!password) {
        ctx.status = 400;
        ctx.body = { success: false, error: 'Password is required' };
        return;
    }

    const row = db
        .prepare('SELECT value FROM system_config WHERE key = ?')
        .get('admin_key') as { value: string } | undefined;

    if (row?.value && safeVerify(password, row.value)) {
        const token = createSession();
        ctx.body = { success: true, token };
        return;
    }

    ctx.status = 401;
    ctx.body = { success: false, error: 'Invalid password' };
});

export default router;
