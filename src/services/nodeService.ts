import { deleteNodeByServername, getNodesPublicList } from '../utils/db.js';
import { createNodeRecord } from '../utils/genialtoken.js';
import { logger } from '../utils/log.js';
import { WebSocketManager } from './wsService.js';


export function createNodeService(wsManager: WebSocketManager) {
    return {
        getKeys() {
            try {
                const result = getNodesPublicList();
                return { success: true, data: result };
            } catch (e) {
                logger.error({ e }, 'Listing nodes failed');
                throw new Error('internal server error');
            }
        },

        createKey(servername: string) {
            try {
                // 先检查该 servername 是否在线，在线就踢掉
                wsManager.kickNodeByServername(servername);

                // 执行数据库更新/创建逻辑
                const result = createNodeRecord(servername);

                return {
                    success: true,
                    data: {
                        token: result.plainToken,
                        uuid: result.uuid
                    }
                };
            } catch (e) {
                logger.error({ e }, 'Node creation/update failed');
                throw new Error('internal server error');
            }
        },

        deleteKey(servername: string) {
            try {
                wsManager.kickNodeByServername(servername);
                const result = deleteNodeByServername(servername);
                if (result.changes >= 1) {
                    return { msg: `Deleted ${servername} node` };
                } else {
                    return { msg: 'No nodes were deleted.' };
                }
            } catch (e) {
                logger.error({ e }, 'Node deletion failed');
                throw new Error('internal server error');
            }
        },

        kickNode(servername: string) {
            try {
                const result = wsManager.kickNodeByServername(servername);
                if (result) {
                    return { msg: `Take the ${servername} node offline` };
                } else {
                    return { msg: 'No nodes went offline' };
                }
            } catch (e) {
                logger.error({ e }, 'Error occurred while taking the node offline');
                throw new Error('internal server error');
            }
        }
    };
}
