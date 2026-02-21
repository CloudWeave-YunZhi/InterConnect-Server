import { randomBytes, createHash, randomUUID } from 'crypto';
import { db } from '../database/initdatabase.js';
import bcrypt from 'bcrypt';
export function createNodeRecord(servername) {
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const nodeData = {
        uuid: randomUUID(),
        servername: servername,
        token_hash: tokenHash,
        create_at: new Date().toISOString()
    };
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO nodes (uuid, servername, token_hash, create_at)
    VALUES (?, ?, ?, ?)
`);
    stmt.run(nodeData.uuid, nodeData.servername, nodeData.token_hash, nodeData.create_at);
    return {
        ...nodeData,
        plainToken
    };
}
export function updateAdminPasswd(password) {
    const saltRounds = 12;
    try {
        const hash = bcrypt.hashSync(password, saltRounds);
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO system_config (key, value)
            VALUES ('admin_key', ?)
        `);
        const result = stmt.run(hash);
        return {
            success: true,
            msg: `Admin password updated (affected rows: ${result.changes})`
        };
    }
    catch (err) {
        return { success: false, error: String(err) };
    }
}
//# sourceMappingURL=genialtoken.js.map