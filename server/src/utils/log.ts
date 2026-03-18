import pino, { Logger } from 'pino';
import { config } from './initconfig.js';

// 初始化logger
const { level, pretty, enable } = config.logger;
console.debug(`[${Date()}] [DEBUG] Initialize log instance`);
export const logger: Logger = pino(
    {
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
                level: (label: string) => ({ level: label })
            }
        }),
        base: undefined
    
    });
