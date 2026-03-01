import { Command } from 'commander';
import { createNodeRecord, updateAdminPasswd } from './utils/genialtoken.js';
import { logger } from './utils/log.js';
import { getNodesPublicList, deleteNodeByServername } from './database/db.js';
const version = '1.0.0';
const program = new Command();
program
    .name('npm run start')
    .description('InterConnect-Server CLI')
    .version(version);
program.hook('preAction', async () => {
    const { setupProcessListeners } = await import('./utils/bootstrap.js');
    await setupProcessListeners();
});
program
    .command('serve')
    .description('start InterConnect-Server')
    .action(async () => {
    const { startServer } = await import('./web/server.js');
    console.info(`
  _____ _____      _____                          
 |_   _/ ____|    / ____|                         
   | || |   _____| (___   ___ _ ____   _____ _ __ 
   | || |  |______\\___ \\ / _ \\ '__\\ \\ / / _ \\ '__|
  _| || |____     ____) |  __/ |   \\ V /  __/ |   
 |_____\\_____|   |_____/ \\___|_|    \\_/ \\___|_|
          version: ${version}
 `);
    console.debug('\n\x1b[33m💡 温馨提示 / Tip\x1b[0m ');
    console.debug('首次运行请使用 \x1b[1m set-admin \x1b[0m 参数设置 admin Token');
    console.debug('First time? Use \x1b[1m set-admin \x1b[0m to config admin  token. \n');
    await startServer();
});
program
    .command('add-node <servername>')
    .description('Generate or reset a new token and UUID,It is recommended to use the /manager/keys interface.')
    .action(async (servername) => {
    const result = createNodeRecord(servername);
    logger.info(`New client token ${result.plainToken}`);
    logger.info(`New client UUID ${result.uuid}`);
    process.exit(0);
});
program
    .command('set-admin <password>')
    .description('Change admin password')
    .action(async (password) => {
    const result = updateAdminPasswd(password);
    if (result.success) {
        logger.info(result.msg);
    }
    else {
        logger.error(result.error);
        process.exit(1);
    }
    process.exit(0);
});
program
    .command('list-nodes')
    .description('List all nodes')
    .action(async () => {
    const result = getNodesPublicList();
    for (const item of result) {
        logger.info(item, 'list node:');
    }
});
program
    .command('del-node <servername>')
    .description('Delete the specified node')
    .action(async (servername) => {
    const result = deleteNodeByServername(servername);
    if (result.changes >= 1) {
        logger.info(`Deleted ${servername} node`);
    }
    else {
        logger.info('No nodes were deleted.');
    }
    process.exit(0);
});
program.parse();
//# sourceMappingURL=app.js.map