const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const KEY_PREFIX_ADMIN = 'mc_admin_';
const KEY_PREFIX_SERVER = 'mc_server_';
const KEY_PREFIX_REGULAR = 'mc_key_';

const KEY_TYPE_ADMIN = 'admin';
const KEY_TYPE_SERVER = 'server';
const KEY_TYPE_REGULAR = 'regular';

class Database {
    constructor(dbPath = 'minecraft_ws.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async init() {
        const SQL = await initSqlJs();
        
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }
        
        this.initDbStructure();
        this.save();
    }

    initDbStructure() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                key_type TEXT NOT NULL,
                server_id TEXT,
                regular_key_id TEXT,
                created_at TEXT NOT NULL,
                last_used TEXT,
                is_active INTEGER DEFAULT 1
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS event_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                server_name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL,
                api_key_id TEXT,
                FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
            )
        `);
    }

    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    generateRandomRawKeyString(prefix) {
        return `${prefix}${uuidv4().replace(/-/g, '')}`;
    }

    async ensureInitialAdminKey() {
        const stmt = this.db.prepare('SELECT 1 FROM api_keys WHERE key_type = ? LIMIT 1');
        stmt.bind([KEY_TYPE_ADMIN]);
        const adminKeyExists = stmt.step();
        stmt.free();

        if (!adminKeyExists) {
            const generatedRawAdminKey = this.generateRandomRawKeyString(KEY_PREFIX_ADMIN);
            const adminKeyName = 'Auto-Generated Admin Key';
            const adminKeyDescription = `Auto-generated on ${new Date().toISOString()}`;
            
            const keyId = uuidv4();
            const keyHash = await bcrypt.hash(generatedRawAdminKey, 10);
            const createdAt = new Date().toISOString();
            
            try {
                this.db.run(
                    'INSERT INTO api_keys (id, name, description, key_hash, key_prefix, key_type, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                    [keyId, adminKeyName, adminKeyDescription, keyHash, KEY_PREFIX_ADMIN, KEY_TYPE_ADMIN, createdAt]
                );
                this.save();
                return { name: adminKeyName, key: generatedRawAdminKey };
            } catch (error) {
                console.error('Error creating initial Admin Key:', error);
                return null;
            }
        }
        return null;
    }

    async createRegularKeyWithServerKey(name, description = '', serverId = null) {
        const regularKeyId = uuidv4();
        const serverKeyId = uuidv4();
        
        // 创建Regular Key
        const regularRawKey = this.generateRandomRawKeyString(KEY_PREFIX_REGULAR);
        const regularKeyHash = await bcrypt.hash(regularRawKey, 10);
        
        // 创建Server Key
        const serverRawKey = this.generateRandomRawKeyString(KEY_PREFIX_SERVER);
        const serverKeyHash = await bcrypt.hash(serverRawKey, 10);
        
        const createdAt = new Date().toISOString();
        
        try {
            // 开始事务
            this.db.exec('BEGIN TRANSACTION');
            
            // 插入Regular Key
            this.db.run(
                'INSERT INTO api_keys (id, name, description, key_hash, key_prefix, key_type, server_id, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
                [regularKeyId, name, description, regularKeyHash, KEY_PREFIX_REGULAR, KEY_TYPE_REGULAR, serverId, createdAt]
            );
            
            // 插入关联的Server Key
            this.db.run(
                'INSERT INTO api_keys (id, name, description, key_hash, key_prefix, key_type, server_id, regular_key_id, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                [serverKeyId, `${name} - Server Key`, `Server Key for ${name}`, serverKeyHash, KEY_PREFIX_SERVER, KEY_TYPE_SERVER, serverId, regularKeyId, createdAt]
            );
            
            // 提交事务
            this.db.exec('COMMIT');
            this.save();
            
            return {
                regularKey: {
                    id: regularKeyId,
                    rawKey: regularRawKey,
                    keyPrefix: KEY_PREFIX_REGULAR,
                    keyType: KEY_TYPE_REGULAR,
                    serverId
                },
                serverKey: {
                    id: serverKeyId,
                    rawKey: serverRawKey,
                    keyPrefix: KEY_PREFIX_SERVER,
                    keyType: KEY_TYPE_SERVER,
                    serverId,
                    regularKeyId
                }
            };
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw new Error('Could not generate unique API key hash');
        }
    }

    async createApiKey(name, description = '', keyType = KEY_TYPE_REGULAR, serverId = null, regularKeyId = null) {
        const keyId = uuidv4();
        let prefix;
        
        switch(keyType) {
            case KEY_TYPE_ADMIN:
                prefix = KEY_PREFIX_ADMIN;
                break;
            case KEY_TYPE_SERVER:
                prefix = KEY_PREFIX_SERVER;
                break;
            default:
                prefix = KEY_PREFIX_REGULAR;
        }
        
        const rawKey = this.generateRandomRawKeyString(prefix);
        const keyHash = await bcrypt.hash(rawKey, 10);
        const createdAt = new Date().toISOString();

        try {
            this.db.run(
                'INSERT INTO api_keys (id, name, description, key_hash, key_prefix, key_type, server_id, regular_key_id, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                [keyId, name, description, keyHash, prefix, keyType, serverId, regularKeyId, createdAt]
            );
            this.save();
            return { keyId, rawKey, keyPrefix: prefix, keyType, serverId, regularKeyId };
        } catch (error) {
            throw new Error('Could not generate unique API key hash');
        }
    }

    async verifyApiKey(keyToCheck) {
        const stmt = this.db.prepare('SELECT id, key_hash, key_type, server_id, regular_key_id FROM api_keys WHERE is_active = 1');
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            const isValid = await bcrypt.compare(keyToCheck, row.key_hash);
            
            if (isValid) {
                stmt.free();
                
                this.db.run(
                    'UPDATE api_keys SET last_used = ? WHERE id = ?',
                    [new Date().toISOString(), row.id]
                );
                this.save();
                
                return { 
                    id: row.id, 
                    keyType: row.key_type,
                    serverId: row.server_id,
                    regularKeyId: row.regular_key_id
                };
            }
        }
        
        stmt.free();
        return null;
    }

    getApiKeyDetailsById(keyId) {
        const stmt = this.db.prepare(
            'SELECT id, name, description, key_prefix, key_type, server_id, regular_key_id, created_at, last_used, is_active FROM api_keys WHERE id = ?'
        );
        stmt.bind([keyId]);
        
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return {
                id: row.id,
                name: row.name,
                description: row.description,
                keyPrefix: row.key_prefix,
                keyType: row.key_type,
                serverId: row.server_id,
                regularKeyId: row.regular_key_id,
                createdAt: row.created_at,
                lastUsed: row.last_used,
                isActive: Boolean(row.is_active)
            };
        }
        
        stmt.free();
        return null;
    }

    getAllApiKeysInfo() {
        const stmt = this.db.prepare(
            'SELECT id, name, description, key_prefix, key_type, server_id, regular_key_id, created_at, last_used, is_active FROM api_keys ORDER BY created_at DESC'
        );
        
        const keys = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            keys.push({
                id: row.id,
                name: row.name,
                description: row.description,
                keyPrefix: row.key_prefix,
                keyType: row.key_type,
                serverId: row.server_id,
                regularKeyId: row.regular_key_id,
                createdAt: row.created_at,
                lastUsed: row.last_used,
                isActive: Boolean(row.is_active)
            });
        }
        
        stmt.free();
        return keys;
    }

    getServerKeysByRegularKeyId(regularKeyId) {
        const stmt = this.db.prepare(
            'SELECT id, name, description, key_prefix, key_type, server_id, created_at, last_used, is_active FROM api_keys WHERE regular_key_id = ? AND key_type = ? ORDER BY created_at DESC'
        );
        stmt.bind([regularKeyId, KEY_TYPE_SERVER]);
        
        const keys = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            keys.push({
                id: row.id,
                name: row.name,
                description: row.description,
                keyPrefix: row.key_prefix,
                keyType: row.key_type,
                serverId: row.server_id,
                createdAt: row.created_at,
                lastUsed: row.last_used,
                isActive: Boolean(row.is_active)
            });
        }
        
        stmt.free();
        return keys;
    }

    toggleApiKeyActivation(keyId, activate) {
        const result = this.db.run(
            'UPDATE api_keys SET is_active = ? WHERE id = ?',
            [activate ? 1 : 0, keyId]
        );
        this.save();
        return result.changes > 0;
    }

    deleteApiKeyById(keyId) {
        const keyInfo = this.getApiKeyDetailsById(keyId);
        
        if (keyInfo && keyInfo.keyType === KEY_TYPE_ADMIN) {
            const stmt = this.db.prepare(
                'SELECT COUNT(*) as count FROM api_keys WHERE key_type = ? AND id != ?'
            );
            stmt.bind([KEY_TYPE_ADMIN, keyId]);
            stmt.step();
            const row = stmt.getAsObject();
            stmt.free();
            
            if (row.count === 0) {
                throw new Error('Cannot delete the last Admin Key');
            }
        }

        const result = this.db.run('DELETE FROM api_keys WHERE id = ?', [keyId]);
        this.save();
        return result.changes > 0;
    }

    logEvent(event, apiKeyId) {
        this.db.run(
            'INSERT INTO event_logs (event_type, server_name, timestamp, data, api_key_id) VALUES (?, ?, ?, ?, ?)',
            [event.event_type, event.server_name, event.timestamp, JSON.stringify(event.data), apiKeyId]
        );
        this.save();
    }

    getRecentEvents(limit = 100) {
        const stmt = this.db.prepare(
            'SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT ?'
        );
        stmt.bind([limit]);
        
        const events = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            events.push({
                id: row.id,
                eventType: row.event_type,
                serverName: row.server_name,
                timestamp: row.timestamp,
                data: JSON.parse(row.data),
                apiKeyId: row.api_key_id
            });
        }
        
        stmt.free();
        return events;
    }
}

module.exports = Database;
module.exports.KEY_TYPE_ADMIN = KEY_TYPE_ADMIN;
module.exports.KEY_TYPE_SERVER = KEY_TYPE_SERVER;
module.exports.KEY_TYPE_REGULAR = KEY_TYPE_REGULAR;
