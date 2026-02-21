import { createHash } from 'crypto';
import { db } from '../database/initdatabase.js';

interface NodeRow {
    uuid: string;
    token_hash: string | null;
    servername: string;
}

function sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

const selectNode = db.prepare<[string], NodeRow>(
    'SELECT uuid, token_hash, servername FROM nodes WHERE uuid = ?'
);

export function verifyNode(uuid: string, token: string): NodeRow | null {
    const row = selectNode.get(uuid);
    if (!row || !row.token_hash) return null;
    if (sha256(token) !== row.token_hash) return null;
    return row;
}