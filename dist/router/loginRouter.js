import { db } from '../utils/initdatabase.js';
import { safeVerify, createSession } from '../middleware/auth.js';
export function loginRouter(req, res) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
    }
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?')
        .get('admin_key');
    if (row?.value && safeVerify(password, row.value)) {
        const token = createSession();
        return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, error: 'Invalid password' });
}
//# sourceMappingURL=loginRouter.js.map