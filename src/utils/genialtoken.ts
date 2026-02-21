import { randomBytes, createHash, randomUUID } from 'crypto';
import { NodeRecord } from '../types/index.js';
import { db } from '../database/initdatabase.js';
import bcrypt from 'bcrypt';

/**
 * 创建节点记录并存入数据库
 * @param servername 手动输入的服务器名称
 * @returns 返回包含明文 Token 的完整记录，由调用者决定如何展示/响应
 */
export function createNodeRecord(servername: string) {
    // 1. 生成原始 Token (用于给用户看)
    const plainToken = randomBytes(32).toString('hex');
  
    // 2. 生成哈希值 (用于存库校验)
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    // 3. 准备数据对象
    const nodeData: NodeRecord = {
        uuid: randomUUID(),
        servername: servername,
        token_hash: tokenHash,
        create_at: new Date().toISOString() // SQLite 通常存储 ISO 字符串
    };

    // 4. 执行数据库写入
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO nodes (uuid, servername, token_hash, create_at)
    VALUES (?, ?, ?, ?)
`);

    stmt.run(
        nodeData.uuid,
        nodeData.servername,
        nodeData.token_hash,
        nodeData.create_at
    );

    // 5. 返回结果：既有存库的 hash，也有一次性的明文 plainToken
    return {
        ...nodeData,
        plainToken 
    };
}

/**
 * 极简 Admin 密码更新函数
 * 直接根据明文密码生成 Hash 并覆盖写入 system_config 表
 */
export function updateAdminPasswd(password: string) {
    // 1. 设置工作因子（Cost Factor）
    // 推荐值为 10-12，越高越安全但越慢
    const saltRounds = 12;

    try {
        // 2. 生成 bcrypt 哈希
        // bcrypt 会自动生成盐并将其编码进最终的字符串中
        const hash = bcrypt.hashSync(password, saltRounds);

        // 3. 执行数据库写入
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO system_config (key, value)
            VALUES ('admin_key', ?)
        `);

        const result = stmt.run(hash);
        
        return { 
            success: true, 
            msg: `Admin password updated (affected rows: ${result.changes})` 
        };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}