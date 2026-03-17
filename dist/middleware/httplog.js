import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/log.js';
export const httplog = pinoHttp({
    logger,
    customSuccessMessage: () => 'Request completed',
    customLogLevel: (_req, res) => {
        if (res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessObject: (req, res, val) => ({
        ip: req.socket.remoteAddress,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        ms: `${val.responseTime}ms`,
        size: res.getHeader('content-length') || 0,
    }),
    serializers: {
        req: () => undefined,
        res: () => undefined,
        err: pino.stdSerializers.err,
    },
});
//# sourceMappingURL=httplog.js.map