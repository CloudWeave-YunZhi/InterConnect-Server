import express from 'express';
import path from 'path';
import history from 'connect-history-api-fallback';

const router = express.Router();

// SPA fallback: /admin/* -> /admin/index.html
router.use(history({
    index: '/index.html'
}));

router.use(express.static(path.join(process.cwd(), 'admin')));

export default router;
