import { deleteNodeByServername, getNodesPublicList } from '../utils/db.js';
import { createNodeRecord } from '../utils/genialtoken.js';
import { logger } from '../utils/log.js';
export function createNodeService(wsManager) {
    return {
        getKeys() {
            try {
                const result = getNodesPublicList();
                return { success: true, data: result };
            }
            catch (e) {
                logger.error({ e }, 'Listing nodes failed');
                throw new Error('internal server error');
            }
        },
        createKey(servername) {
            try {
                wsManager.kickNodeByServername(servername);
                const result = createNodeRecord(servername);
                return {
                    success: true,
                    data: {
                        token: result.plainToken,
                        uuid: result.uuid
                    }
                };
            }
            catch (e) {
                logger.error({ e }, 'Node creation/update failed');
                throw new Error('internal server error');
            }
        },
        deleteKey(servername) {
            try {
                wsManager.kickNodeByServername(servername);
                const result = deleteNodeByServername(servername);
                if (result.changes >= 1) {
                    return { msg: `Deleted ${servername} node` };
                }
                else {
                    return { msg: 'No nodes were deleted.' };
                }
            }
            catch (e) {
                logger.error({ e }, 'Node deletion failed');
                throw new Error('internal server error');
            }
        },
        kickNode(servername) {
            try {
                const result = wsManager.kickNodeByServername(servername);
                if (result) {
                    return { msg: `Take the ${servername} node offline` };
                }
                else {
                    return { msg: 'No nodes went offline' };
                }
            }
            catch (e) {
                logger.error({ e }, 'Error occurred while taking the node offline');
                throw new Error('internal server error');
            }
        }
    };
}
//# sourceMappingURL=nodeService.js.map