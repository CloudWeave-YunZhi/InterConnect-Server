import { logger } from '../utils/log.js';
function toByteLength(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
function getLevel(status) {
    if (status >= 500)
        return 'error';
    if (status >= 400)
        return 'warn';
    return 'info';
}
export async function httplog(ctx, next) {
    const startedAt = process.hrtime.bigint();
    const requestSize = toByteLength(ctx.get('content-length'));
    let logged = false;
    const logOnDone = () => {
        if (logged)
            return;
        logged = true;
        const status = ctx.status || ctx.res.statusCode || 200;
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const responseSize = toByteLength(ctx.response.get('content-length'));
        logger[getLevel(status)]({
            ip: ctx.ip,
            method: ctx.method,
            path: ctx.originalUrl,
            status,
            ms: `${elapsedMs.toFixed(1)}ms`,
            requestSize,
            responseSize,
        }, 'Request completed');
    };
    ctx.res.once('finish', logOnDone);
    ctx.res.once('close', logOnDone);
    await next();
}
//# sourceMappingURL=httplog.js.map