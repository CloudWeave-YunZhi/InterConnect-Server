import { deleteNodeByServername, getNodesPublicList } from '../../database/db.js';
import { createNodeRecord } from '../../utils/genialtoken.js';
import { logger } from '../../utils/log.js';
import express from 'express';
import { kickNodeByServername } from '../websocket.js';


const router = express.Router();

router.get('/keys',(req, res, next)=>{
    try{
        const result = getNodesPublicList();
        res.json({success: true, data: result});
    }catch(e){
        res.status(500).json({msg: 'internal server error'});
        logger.error({e},'Listing nodes failed');
    }
});
router.post('/keys/:servername', (req, res, next) => {
    try {
        const servername = req.params.servername;

        // 1. 【核心逻辑】先检查该 servername 是否在线，在线就踢掉
        // 这样可以防止同一个服务器名拥有多个活跃连接
        kickNodeByServername(servername);

        // 2. 执行数据库更新/创建逻辑
        const result = createNodeRecord(servername);

        // 3. 返回新产生的凭据
        res.status(201).json({
            success: true, 
            data: {
                token: result.plainToken,
                uuid: result.uuid
            }
        });
    } catch (e) {
        logger.error({ e }, 'Node creation/update failed');
        res.status(500).json({ msg: 'internal server error' });
    }
    router.delete('/keys/:servername', (req, res, next)=>{
        try{
            const servername = req.params.servername;
            kickNodeByServername(servername);
            const result = deleteNodeByServername(servername);
            if(result.changes >= 1){
                res.json({msg: `Deleted ${servername} node`});
            }else{
                res.json({msg: 'No nodes were deleted.'});
            }
        }catch(e){
            res.status(500).json({msg: 'internal server error'});
            logger.error({e},'Node deletion failed');
        }
    });
});
router.post('/kick/:servername', (req, res, next)=>{
    try{
        const servername = req.params.servername;
        const result = kickNodeByServername(servername);
        if(result){
            res.json({msg: `Take the ${servername} node offline`});
        }else{
            res.json({msg: 'No nodes went offline'});
        }
    }catch(e){
        res.status(500).json({msg: 'internal server error'});
        logger.error({e},'Error occurred while taking the node offline');
    }
});

export default router;