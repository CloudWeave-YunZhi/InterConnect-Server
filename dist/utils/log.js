import pino from 'pino';
import { config } from './initconfig.js';
const { level, pretty, enable } = config.logger;
console.debug(`[${Date()}] [DEBUG] Initialize log instance`);
export const logger = pino({
    level: enable ? level : 'silent',
    ...(pretty && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
                relativeTime: false,
                messageFormat: '{msg}'
            }
        },
        serializers: {
            err: pino.stdSerializers.err,
            reason: pino.stdSerializers.err,
        }
    }),
    ...(!pretty && {
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level: (label) => ({ level: label })
        }
    }),
    base: undefined
});
//# sourceMappingURL=log.js.map