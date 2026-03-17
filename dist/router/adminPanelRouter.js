import express from 'express';
import path from 'path';
import history from 'connect-history-api-fallback';
const router = express.Router();
router.use(history({
    index: '/index.html'
}));
router.use(express.static(path.join(process.cwd(), 'admin')));
export default router;
//# sourceMappingURL=adminPanelRouter.js.map