import { logger } from './log.js';
export function setupProcessListeners() {
    process.on('uncaughtException', (e) => {
        logger.fatal({ e }, 'Uncaught error,process exit:');
        process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled Promise Rejection');
    });
    process.on('SIGINT', () => {
        logger.info('Received SIGINT signal, shutting down');
        process.exit(0);
    });
}
//# sourceMappingURL=bootstrap.js.map