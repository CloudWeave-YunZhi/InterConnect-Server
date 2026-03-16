import express from 'express';
import { NodeService } from '../services/nodeService.js';
const router = express.Router();
router.get('/keys', (_, res) => {
    try {
        const result = NodeService.getKeys();
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ msg: 'internal server error' });
    }
});
router.post('/keys/:servername', (req, res) => {
    try {
        const servername = req.params.servername;
        const result = NodeService.createKey(servername);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(500).json({ msg: 'internal server error' });
    }
});
router.delete('/keys/:servername', (req, res) => {
    try {
        const servername = req.params.servername;
        const result = NodeService.deleteKey(servername);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ msg: 'internal server error' });
    }
});
router.post('/kick/:servername', (req, res) => {
    try {
        const servername = req.params.servername;
        const result = NodeService.kickNode(servername);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ msg: 'internal server error' });
    }
});
export default router;
//# sourceMappingURL=managerRouter.js.map