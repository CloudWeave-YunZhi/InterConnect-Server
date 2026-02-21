import { db } from './initdatabase.js';
import { NodePublicInfo } from '../types/index.js';


export function getNodesPublicList(): NodePublicInfo[] {
    /** * 获取所有节点的脱敏列表
     * 明确排除 ID 和 Token 等敏感信息
     */
    // 在 SQL 里只 SELECT 需要的列
    return db.prepare(`
            SELECT uuid, servername, stat, create_at 
            FROM nodes 
            ORDER BY stat DESC, create_at DESC
        `).all() as NodePublicInfo[];
};
/**
 * 数据库操作：根据 servername 物理删除记录
 */
export function deleteNodeByServername(servername: string) {
    const stmt = db.prepare('DELETE FROM nodes WHERE servername = ?');
    return stmt.run(servername);
}