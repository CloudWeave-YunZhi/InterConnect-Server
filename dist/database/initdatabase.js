import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/log.js';
const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}
let instance;
try {
    instance = new DatabaseConstructor(DB_PATH);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
    instance.exec(`
        CREATE TABLE IF NOT EXISTS system_config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO system_config (key, value) VALUES ('admin_key', 'initial_aes_encrypted_data');

        CREATE TABLE IF NOT EXISTS nodes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid  TEXT UNIQUE NOT NULL,
            token_hash TEXT NOT NULL,
            servername TEXT NOT NULL UNIQUE,
            stat       INTEGER,
            create_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
    `);
}
catch (err) {
    logger.fatal({ err, path: DB_PATH }, 'Failed to initialise database');
    process.exit(1);
}
if (instance == null) {
    logger.fatal('Database instance is null or undefined after initialisation logic');
    process.exit(1);
}
export const db = instance;
//# sourceMappingURL=initdatabase.js.map