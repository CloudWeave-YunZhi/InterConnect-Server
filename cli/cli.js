#!/usr/bin/env node
const { Command } = require('commander');
const http = require('http');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const HARDCODED_API_URL = 'http://localhost:8000';
const HARDCODED_ADMIN_KEY = process.env.ADMIN_KEY || null;

class MinecraftWSCLIClient {
    constructor(serverUrl, adminKey) {
        this.serverUrl = serverUrl.replace(/\/$/, '');
        this.effectiveAdminKey = adminKey || HARDCODED_ADMIN_KEY;
    }

    async request(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.serverUrl);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (this.effectiveAdminKey) {
                options.headers['Authorization'] = `Bearer ${this.effectiveAdminKey}`;
            }
            
            const req = lib.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        if (res.statusCode === 204 || !body) {
                            resolve(null);
                        } else {
                            try {
                                resolve(JSON.parse(body));
                            } catch {
                                resolve(body);
                            }
                        }
                    } else {
                        let detail = body;
                        try {
                            const json = JSON.parse(body);
                            detail = json.detail || body;
                        } catch {}
                        reject(new Error(`API请求失败 (${res.statusCode}): ${detail}`));
                    }
                });
            });
            
            req.on('error', (e) => reject(new Error(`网络请求失败: ${e.message}`)));
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    ensureAdminKeyForManagement() {
        if (!this.effectiveAdminKey) {
            throw new Error('此管理操作需要Admin Key。请通过--admin-key选项或ADMIN_KEY环境变量提供。');
        }
    }

    async createApiKey(name, description = '', keyType = 'regular', serverId = null) {
        this.ensureAdminKeyForManagement();
        return await this.request('POST', '/manage/keys', {
            name,
            description,
            key_type: keyType,
            server_id: serverId
        });
    }

    async listApiKeys() {
        this.ensureAdminKeyForManagement();
        return await this.request('GET', '/manage/keys');
    }

    async getApiKeyDetails(keyId) {
        this.ensureAdminKeyForManagement();
        return await this.request('GET', `/manage/keys/${keyId}`);
    }

    async activateApiKey(keyId) {
        this.ensureAdminKeyForManagement();
        return await this.request('PATCH', `/manage/keys/${keyId}/activate`);
    }

    async deactivateApiKey(keyId) {
        this.ensureAdminKeyForManagement();
        return await this.request('PATCH', `/manage/keys/${keyId}/deactivate`);
    }

    async deleteApiKey(keyId) {
        this.ensureAdminKeyForManagement();
        await this.request('DELETE', `/manage/keys/${keyId}`);
        return true;
    }

    async healthCheck() {
        return await this.request('GET', '/health');
    }
}

const program = new Command();

program
    .name('minecraft-ws-cli')
    .description('Minecraft WebSocket API CLI - 管理API密钥和服务器')
    .version('1.0.0')
    .option('-s, --server-url <url>', 'API服务器URL', process.env.MC_WS_API_URL || HARDCODED_API_URL)
    .option('-k, --admin-key <key>', '用于管理操作的Admin Key', process.env.ADMIN_KEY || HARDCODED_ADMIN_KEY);

program
    .command('create-key <name>')
    .description('创建新的API密钥')
    .option('-d, --description <desc>', 'API密钥描述', '')
    .option('-t, --type <type>', '密钥类型: admin, server, regular', 'regular')
    .option('--server-id <id>', '关联的服务器ID（仅server类型需要）')
    .action(async (name, options) => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const result = await client.createApiKey(name, options.description, options.type, options.serverId);
            
            const keyTypeNames = { admin: 'Admin Key', server: 'Server Key', regular: '普通Key' };
            
            if (result.regularKey && result.serverKey) {
                // 返回了Regular Key和关联的Server Key
                console.log(`\x1b[32m✅ 成功创建Regular Key和关联的Server Key!\x1b[0m`);
                console.log('='.repeat(60));
                
                // 显示Regular Key
                console.log(`\x1b[34m🔑 Regular Key:${keyTypeNames[result.regularKey.keyType]}\x1b[0m`);
                console.log(`  ID: ${result.regularKey.id}`);
                console.log(`  名称: ${result.regularKey.name}`);
                console.log(`  描述: ${result.regularKey.description || '无'}`);
                console.log(`  前缀: ${result.regularKey.keyPrefix}`);
                if (result.regularKey.serverId) {
                    console.log(`  服务器ID: ${result.regularKey.serverId}`);
                }
                console.log(`  创建时间: ${result.regularKey.createdAt}`);
                console.log(`\x1b[33m🔑 原始密钥 (请妥善保存，仅显示一次):\x1b[0m`);
                console.log(`\x1b[31m  ${result.regularKey.key}\x1b[0m`);
                console.log();
                
                // 显示关联的Server Key
                console.log(`\x1b[34m🖥️ Server Key:${keyTypeNames[result.serverKey.keyType]}\x1b[0m`);
                console.log(`  ID: ${result.serverKey.id}`);
                console.log(`  名称: ${result.serverKey.name}`);
                console.log(`  描述: ${result.serverKey.description || '无'}`);
                console.log(`  前缀: ${result.serverKey.keyPrefix}`);
                if (result.serverKey.serverId) {
                    console.log(`  服务器ID: ${result.serverKey.serverId}`);
                }
                console.log(`  创建时间: ${result.serverKey.createdAt}`);
                console.log(`\x1b[33m🔑 原始密钥 (请妥善保存，仅显示一次):\x1b[0m`);
                console.log(`\x1b[31m  ${result.serverKey.key}\x1b[0m`);
                console.log('='.repeat(60));
                console.log();
                console.log('使用示例:');
                console.log(`  Regular Key登录控制面板: http://localhost:8000/dashboard`);
                console.log(`  Server Key用于插件配置: 放入Minecraft插件的配置文件中`);
            } else {
                // 返回了单个密钥
                const keyType = keyTypeNames[result.keyType] || result.keyType;
                
                console.log(`\x1b[32m✅ ${keyType}创建成功!\x1b[0m`);
                console.log(`  ID: ${result.id}`);
                console.log(`  名称: ${result.name}`);
                console.log(`  类型: ${keyType}`);
                console.log(`  前缀: ${result.keyPrefix}`);
                if (result.serverId) {
                    console.log(`  服务器ID: ${result.serverId}`);
                }
                console.log(`  创建时间: ${result.createdAt}`);
                console.log(`\x1b[33m🔑 原始密钥 (请妥善保存，仅显示一次):\x1b[0m`);
                console.log(`\x1b[31m  ${result.key}\x1b[0m`);
                console.log();
                console.log('使用示例:');
                console.log(`  WebSocket连接: ws://localhost:8000/ws?api_key=${result.key}`);
                console.log(`  HTTP请求头: Authorization: Bearer ${result.key}`);
            }
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('list-keys')
    .description('列出所有API密钥')
    .action(async () => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const keys = await client.listApiKeys();
            
            if (keys.length === 0) {
                console.log('📭 没有找到API密钥.');
                return;
            }
            
            console.log(`\x1b[34m📋 API密钥列表 (共 ${keys.length} 个):\x1b[0m`);
            
            const keyTypeIcons = { admin: '👑', server: '🖥️', regular: '🔑' };
            const keyTypeNames = { admin: 'Admin', server: 'Server', regular: 'Regular' };
            
            for (const key of keys) {
                const status = key.isActive ? '\x1b[32m🟢 活跃\x1b[0m' : '\x1b[31m🔴 已停用\x1b[0m';
                const icon = keyTypeIcons[key.keyType] || '🔑';
                const typeName = keyTypeNames[key.keyType] || key.keyType;
                const lastUsed = key.lastUsed || '从未使用';
                
                console.log('-'.repeat(50));
                console.log(`  ID         : ${key.id}`);
                console.log(`  名称       : ${key.name}`);
                console.log(`  类型       : ${icon} ${typeName}`);
                console.log(`  状态       : ${status}`);
                console.log(`  前缀       : ${key.keyPrefix}`);
                if (key.serverId) {
                    console.log(`  服务器ID   : ${key.serverId}`);
                }
                console.log(`  创建时间   : ${key.createdAt}`);
                console.log(`  最后使用   : ${lastUsed}`);
            }
            console.log('-'.repeat(50));
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('get-key <key_id>')
    .description('获取特定API密钥的详细信息')
    .action(async (keyId) => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const key = await client.getApiKeyDetails(keyId);
            
            const keyTypeIcons = { admin: '👑', server: '🖥️', regular: '🔑' };
            const keyTypeNames = { admin: 'Admin', server: 'Server', regular: 'Regular' };
            
            const status = key.isActive ? '\x1b[32m🟢 活跃\x1b[0m' : '\x1b[31m🔴 已停用\x1b[0m';
            const icon = keyTypeIcons[key.keyType] || '🔑';
            const typeName = keyTypeNames[key.keyType] || key.keyType;
            const lastUsed = key.lastUsed || '从未使用';
            
            console.log(`\x1b[34m📄 密钥详情 (ID: ${key.id}):\x1b[0m`);
            console.log(`  名称       : ${key.name}`);
            console.log(`  描述       : ${key.description || '无'}`);
            console.log(`  类型       : ${icon} ${typeName}`);
            console.log(`  状态       : ${status}`);
            console.log(`  前缀       : ${key.keyPrefix}`);
            if (key.serverId) {
                console.log(`  服务器ID   : ${key.serverId}`);
            }
            console.log(`  创建时间   : ${key.createdAt}`);
            console.log(`  最后使用   : ${lastUsed}`);
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('activate-key <key_id>')
    .description('激活指定的API密钥')
    .action(async (keyId) => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const result = await client.activateApiKey(keyId);
            console.log(`\x1b[32m✅ ${result.message}\x1b[0m`);
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('deactivate-key <key_id>')
    .description('停用指定的API密钥')
    .action(async (keyId) => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const result = await client.deactivateApiKey(keyId);
            console.log(`\x1b[32m✅ ${result.message}\x1b[0m`);
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('delete-key <key_id>')
    .description('永久删除指定的API密钥')
    .action(async (keyId) => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            await client.deleteApiKey(keyId);
            console.log(`\x1b[32m✅ API密钥 ${keyId} 已成功删除!\x1b[0m`);
        } catch (error) {
            console.error(`\x1b[31m❌ 错误: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('health')
    .description('检查服务器健康状态')
    .action(async () => {
        try {
            const opts = program.opts();
            const client = new MinecraftWSCLIClient(opts.serverUrl, opts.adminKey);
            const result = await client.healthCheck();
            
            console.log('\x1b[34m🏥 服务器健康状态:\x1b[0m');
            const statusIcon = result.status === 'healthy' ? '🟢' : '🔴';
            console.log(`  状态          : ${statusIcon} ${result.status}`);
            console.log(`  时间戳        : ${result.timestamp}`);
            console.log(`  活跃WS连接数  : ${result.active_ws}`);
            console.log(`  总密钥数      : ${result.keys_total}`);
            console.log(`  活跃Admin Keys: ${result.admin_active}`);
            console.log(`  活跃Server Keys: ${result.server_active}`);
            console.log(`  活跃Regular Keys: ${result.regular_active}`);
            
            if (result.status === 'healthy') {
                console.log('\x1b[32m✅ 服务器运行正常\x1b[0m');
            } else {
                console.log('\x1b[33m⚠️ 服务器状态异常\x1b[0m');
            }
        } catch (error) {
            console.error(`\x1b[31m❌ 服务器连接或检查失败: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program
    .command('generate-config [filename]')
    .description('为Minecraft插件生成配置文件模板')
    .action(async (filename = 'mc_ws_plugin_config.json') => {
        try {
            const opts = program.opts();
            const wsUrl = opts.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
            
            const configTemplate = {
                websocket_settings: {
                    server_address: `${wsUrl}/ws`,
                    reconnect_delay_seconds: 10,
                    ping_interval_seconds: 30
                },
                api_key: 'PASTE_YOUR_GENERATED_API_KEY_HERE',
                server_identifier: 'MyMinecraftServer_1',
                log_level: 'INFO',
                enabled_events: {
                    player_join: true,
                    player_quit: true,
                    player_chat: false,
                    player_death: true
                }
            };
            
            fs.writeFileSync(filename, JSON.stringify(configTemplate, null, 4));
            console.log(`\x1b[32m✅ 插件配置文件模板已生成: ${filename}\x1b[0m`);
        } catch (error) {
            console.error(`\x1b[31m❌ 生成配置文件失败: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    });

program.parse();
