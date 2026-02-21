import { createHash } from 'crypto';
import { db } from '../database/initdatabase.js';
function sha256(input) {
    return createHash('sha256').update(input).digest('hex');
}
const selectNode = db.prepare('SELECT uuid, token_hash, servername FROM nodes WHERE uuid = ?');
export function verifyNode(uuid, token) {
    const row = selectNode.get(uuid);
    if (!row || !row.token_hash)
        return null;
    if (sha256(token) !== row.token_hash)
        return null;
    return row;
}
//# sourceMappingURL=wsauth.js.map