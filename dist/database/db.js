import { db } from './initdatabase.js';
export function getNodesPublicList() {
    return db.prepare(`
            SELECT uuid, servername, stat, create_at 
            FROM nodes 
            ORDER BY stat DESC, create_at DESC
        `).all();
}
;
export function deleteNodeByServername(servername) {
    const stmt = db.prepare('DELETE FROM nodes WHERE servername = ?');
    return stmt.run(servername);
}
//# sourceMappingURL=db.js.map