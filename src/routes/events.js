const express = require('express');
const router = express.Router();

function createEventsRouter(db, manager, requireAnyKey) {
    router.post('/', requireAnyKey, async (req, res) => {
        try {
            const event = req.body;
            
            if (!event.event_type || !event.server_name || !event.timestamp || !event.data) {
                return res.status(400).json({ detail: 'Missing required event fields' });
            }
            
            db.logEvent(event, req.apiKey.id);
            
            const message = {
                type: 'minecraft_event',
                event: event,
                source_key_id_prefix: req.apiKey.id.substring(0, 8)
            };
            
            await manager.broadcastToAll(message);
            
            res.json({ message: 'Event received and broadcasted' });
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    return router;
}

module.exports = createEventsRouter;
