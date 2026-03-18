import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../utils/initdatabase.js';
const sessions = new Map();
export function createSession() {
    const token = randomBytes(32).toString('hex');
    const expireAt = Date.now() + 60 * 60 * 1000;
    sessions.set(token, { expireAt });
    return token;
}
function isValidSession(token) {
    const data = sessions.get(token);
    if (!data)
        return false;
    if (Date.now() > data.expireAt) {
        sessions.delete(token);
        return false;
    }
    return true;
}
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of sessions.entries()) {
        if (now > data.expireAt)
            sessions.delete(token);
    }
}, 10 * 60 * 1000);
export const adminAuth = async (ctx, next) => {
    const authHeader = ctx.get('authorization');
    if (authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        if (isValidSession(sessionToken)) {
            await next();
            return;
        }
    }
    const adminToken = ctx.get('x-admin-token');
    if (adminToken) {
        const row = db
            .prepare('SELECT value FROM system_config WHERE key = ?')
            .get('admin_key');
        if (row?.value && safeVerify(adminToken, row.value)) {
            await next();
            return;
        }
    }
    ctx.status = 401;
    ctx.body = { error: 'Admin access denied or Session expired' };
};
export function safeVerify(plain, hash) {
    try {
        return bcrypt.compareSync(plain, hash);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=auth.js.map