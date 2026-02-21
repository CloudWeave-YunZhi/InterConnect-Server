import { app } from './server.js';
import { config } from '../utils/initconfig.js';
import { Response, Request, NextFunction } from 'express';
import { db } from '../database/initdatabase.js';
import { adminAuth, safeVerify, createSession } from './middleware/auth.js';
import createmgr from './routes/manager.js';
import ratelimit from 'express-rate-limit';
import { SqliteStore } from 'rate-limit-sqlite';
import path from 'node:path';

const  limiter = ratelimit({
    windowMs: config.ratelimit.windowMs * 60 * 1000,
    limit: config.ratelimit.limit,
    message: config.ratelimit.message,
    standardHeaders: 'draft-8',
    store: new SqliteStore({
        location: path.resolve('./data', 'app.db'),
        prefix: 'limit'
    })
});

export async function  createRouters(): Promise<void> {
    app.use('/manager', limiter, adminAuth(), createmgr);


    app.post('/login', limiter, (req: Request, res: Response) => {
        // 1. 检查 body 是否被解析（防止中间件挂载失败或 Content-Type 不对）
        if (!req.body || typeof req.body !== 'object') {
            // 返回 400 而不是 500，这是客户端的错
            return res.status(400).json({ success: false, error: 'Invalid JSON body' });
        }
            
        const { password } = req.body;

        // 1. 验证输入是否存在
        if (!password) {
            return res.status(400).json({ success: false, error: 'Password is required' });
        }

        const row = db.prepare('SELECT value FROM system_config WHERE key = ?')
            .get('admin_key') as { value: string } | undefined;

        // 2. 验证密码逻辑
        if (row?.value && safeVerify(password, row.value)) {
            const token = createSession();
            // 成功路径：必须 return 确保逻辑终结
            return res.json({ success: true, token });
        }

        // 3. 失败路径：如果上面的 if 没进去，统一走这里
        // 这样就覆盖了所有路径，消灭了 TS 报错
        return res.status(401).json({ success: false, error: 'Invalid password' });
    });
}