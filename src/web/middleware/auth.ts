import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../../database/initdatabase.js';
import { Request, Response, NextFunction } from 'express';

// --- Session 内存管理 ---
interface SessionData {
    expireAt: number;
}

// 内存存储：Token -> 过期时间
const sessions = new Map<string, SessionData>();

/**
 * 创建新会话 (有效期1小时)
 */
export function createSession(): string {
    const token = randomBytes(32).toString('hex');
    const expireAt = Date.now() + 60 * 60 * 1000; // 1小时
    sessions.set(token, { expireAt });
    return token;
}

/**
 * 验证 Session 是否有效
 */
function isValidSession(token: string): boolean {
    const data = sessions.get(token);
    if (!data) return false;
    if (Date.now() > data.expireAt) {
        sessions.delete(token);
        return false;
    }
    return true;
}

// 每 10 分钟清理一次内存中的过期 Token
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of sessions.entries()) {
        if (now > data.expireAt) sessions.delete(token);
    }
}, 10 * 60 * 1000);

// --- 核心中间件 ---

interface ConfigRow {
    value: string;
}

export const adminAuth = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        // 1. 优先尝试 Session 验证 (用于面板 Bearer Token)
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const sessionToken = authHeader.substring(7);
            if (isValidSession(sessionToken)) {
                return next();
            }
        }

        // 2. 尝试静态 Token 验证 (用于脚本 x-admin-token)
        const adminToken = req.headers['x-admin-token'];
        if (typeof adminToken === 'string') {
            const row = db.prepare('SELECT value FROM system_config WHERE key = ?')
                .get('admin_key') as ConfigRow | undefined;

            if (row?.value && safeVerify(adminToken, row.value)) {
                return next();
            }
        }
        
        // 3. 均验证失败
        res.status(401).json({ error: 'Admin access denied or Session expired' });
    };
};

/**
 * 安全比对函数
 * 使用 bcrypt 对密码/密钥进行安全校验
 */
export function safeVerify(plain: string, hash: string): boolean {
    try {
        // `hash` 应为存储在数据库中的 bcrypt 哈希
        return bcrypt.compareSync(plain, hash);
    } catch {
        // 当传入的 hash 不是合法的 bcrypt 字符串时，安全地返回失败
        return false;
    }
}