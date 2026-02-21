import { app } from './server.js';
import { config } from '../utils/initconfig.js';
import { db } from '../database/initdatabase.js';
import { adminAuth, safeVerify, createSession } from './middleware/auth.js';
import createmgr from './routes/manager.js';
import ratelimit from 'express-rate-limit';
import { SqliteStore } from 'rate-limit-sqlite';
import path from 'node:path';
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
export async function createRouters() {
    app.use('/manager', limiter, adminAuth(), createmgr);
    app.post('/login', limiter, (req, res) => {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid JSON body' });
        }
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, error: 'Password is required' });
        }
        const row = db.prepare('SELECT value FROM system_config WHERE key = ?')
            .get('admin_key');
        if (row?.value && safeVerify(password, row.value)) {
            const token = createSession();
            return res.json({ success: true, token });
        }
        return res.status(401).json({ success: false, error: 'Invalid password' });
    });
}
//# sourceMappingURL=routers.js.map