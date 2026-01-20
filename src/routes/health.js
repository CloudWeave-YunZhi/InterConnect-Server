const express = require('express');
const router = express.Router();
const { KEY_TYPE_ADMIN, KEY_TYPE_SERVER, KEY_TYPE_REGULAR } = require('../database');

function createHealthRouter(db, manager) {
    router.get('/', (req, res) => {
        try {
            const allKeys = db.getAllApiKeysInfo();
            
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                active_ws: manager.getActiveConnectionsCount(),
                keys_total: allKeys.length,
                admin_active: allKeys.filter(k => k.keyType === KEY_TYPE_ADMIN && k.isActive).length,
                server_active: allKeys.filter(k => k.keyType === KEY_TYPE_SERVER && k.isActive).length,
                regular_active: allKeys.filter(k => k.keyType === KEY_TYPE_REGULAR && k.isActive).length
            });
        } catch (error) {
            res.status(500).json({ status: 'unhealthy', error: error.message });
        }
    });

    return router;
}

module.exports = createHealthRouter;
