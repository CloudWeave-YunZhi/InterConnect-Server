import ratelimit from 'koa-ratelimit';
import { config } from '../utils/initconfig.js';

const rateLimitStore = new Map();

export const limiter = ratelimit({
    driver: 'memory',
    db: rateLimitStore,
    duration: config.ratelimit.windowMs * 60 * 1000,
    max: config.ratelimit.limit,
    errorMessage: config.ratelimit.message,
    id: (ctx) => ctx.ip,
    namespace: 'limit',
});
