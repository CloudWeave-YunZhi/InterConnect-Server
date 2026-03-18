import fs from 'fs-extra';
import path from 'path';
import { AppConfig } from 'src/types/index.js';

/**
 * 初始化配置，应在应用启动最早期调用一次
 * @returns {Promise<void>} 仅创建并且写入json
 */
async function initConfig(): Promise<void> {
    try{
        const configFile = path.join(process.cwd(), 'data', 'config.json');
        const configstat = await fs.pathExists(configFile);
        if (!configstat){
            console.debug(`[${Date()}] [DEBUG] No configuration file found in ${configFile},a new configuration file will be created.`);
            const configData = {
                'server': {
                    'addr': '0.0.0.0',
                    'port': 8000
                },
                'logger': {
                    'enable': true,
                    'level': 'info',
                    'pretty': true
                },
                'ratelimit': {
                    'windowMs': 5,
                    'limit': 100,
                    'message': 'too many request'
                }
            };
            await fs.outputJsonSync(configFile, configData, {spaces: 4});
        }
    }catch(e){
        console.error(`[${Date()}] [ERROR] Configuration file initialization failed: ${e},process exit`);
        process.exit(1);
    }
}

/**
 * 读取配置文件，应该在initConfig之后
 * @param {Promise<AppConfig>} 返回配置文件对象 
 */
async function readConfig(): Promise<AppConfig>{
    try{
        console.debug(`[${Date()}] [DEBUG] Read the configuration file in ${path.join(process.cwd(), 'data', 'config.json')}`);
        return await fs.readJSON(path.join(process.cwd(), 'data', 'config.json'));
    }catch(e){
        console.error(`[${Date()}] [ERROR] Failed to read configuration file: ${e}`);
        process.exit(1);
    }
}
await initConfig();
const config = await readConfig();
export { initConfig, config };