import ratelimit from 'express-rate-limit';
import { SqliteStore } from 'rate-limit-sqlite';
import path from 'path';
import { config } from '../utils/initconfig.js';

export const limiter = ratelimit({
    windowMs: config.ratelimit.windowMs * 60 * 1000,
    limit: config.ratelimit.limit,
    message: config.ratelimit.message,
    standardHeaders: 'draft-8',
    store: new SqliteStore({
        location: path.resolve('./data', 'app.db'),
        prefix: 'limit'
    })
});
