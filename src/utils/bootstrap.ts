// src/utils/bootstrap.ts
import { logger } from './log.js';

export function setupProcessListeners() {

    // 未捕获的错误
    process.on('uncaughtException', (e) => {
        logger.fatal({e},'Uncaught error,process exit:');
        process.exit(1);
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled Promise Rejection');
    });

    // 监听ctrl-c并正常退出
    process.on('SIGINT', () => {
        logger.info('Received SIGINT signal, shutting down');
        process.exit(0);
    });
}