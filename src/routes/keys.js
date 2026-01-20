const express = require('express');
const router = express.Router();
const { KEY_TYPE_ADMIN, KEY_TYPE_SERVER, KEY_TYPE_REGULAR } = require('../database');
const { requireRegularKeyForOwnServerKeys, requireRegularOrAdminKey } = require('../auth');

function createKeysRouter(db, requireAdminKey) {
    router.post('/', requireAdminKey, async (req, res) => {
        try {
            const { name, description = '', key_type = KEY_TYPE_REGULAR, server_id = null } = req.body;

            if (!name) {
                return res.status(400).json({ detail: 'Name is required' });
            }

            if (key_type === KEY_TYPE_REGULAR) {
                // 创建Regular Key并自动生成关联的Server Key
                const result = await db.createRegularKeyWithServerKey(name, description, server_id);

                res.status(201).json({
                    regularKey: {
                        ...db.getApiKeyDetailsById(result.regularKey.id),
                        key: result.regularKey.rawKey
                    },
                    serverKey: {
                        ...db.getApiKeyDetailsById(result.serverKey.id),
                        key: result.serverKey.rawKey
                    }
                });
            } else {
                // 创建单个Admin或Server Key
                const result = await db.createApiKey(name, description, key_type, server_id);
                const details = db.getApiKeyDetailsById(result.keyId);

                res.status(201).json({
                    ...details,
                    key: result.rawKey
                });
            }
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    router.get('/', requireAdminKey, (req, res) => {
        try {
            const keys = db.getAllApiKeysInfo();
            res.json(keys);
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    // Regular Key获取自己的Server Key列表
    router.get('/server-keys', requireRegularOrAdminKey, (req, res) => {
        try {
            if (req.apiKey.keyType === KEY_TYPE_ADMIN) {
                // Admin获取所有Server Key
                const allKeys = db.getAllApiKeysInfo();
                const serverKeys = allKeys.filter(key => key.keyType === KEY_TYPE_SERVER);
                res.json(serverKeys);
            } else if (req.apiKey.keyType === KEY_TYPE_REGULAR) {
                // Regular Key获取自己关联的Server Key
                const serverKeys = db.getServerKeysByRegularKeyId(req.apiKey.id);
                res.json(serverKeys);
            }
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    // Regular Key为自己创建新的Server Key
    // 只有Admin Key可以为Regular Key创建Server Key
    router.post('/server-keys', requireAdminKey, async (req, res) => {
        try {
            const { name, description = '', server_id = null, regular_key_id } = req.body;

            if (!name) {
                return res.status(400).json({ detail: 'Name is required' });
            }

            if (!regular_key_id) {
                return res.status(400).json({ detail: 'regular_key_id is required' });
            }

            const regularKeyInfo = db.getApiKeyDetailsById(regular_key_id);
            if (!regularKeyInfo || regularKeyInfo.keyType !== KEY_TYPE_REGULAR) {
                return res.status(404).json({ detail: 'Invalid Regular Key ID' });
            }

            const result = await db.createApiKey(name, description, KEY_TYPE_SERVER, server_id, regular_key_id);
            const details = db.getApiKeyDetailsById(result.keyId);

            res.status(201).json({
                ...details,
                key: result.rawKey
            });
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    router.get('/:key_id', requireRegularKeyForOwnServerKeys(db), (req, res) => {
        try {
            const details = db.getApiKeyDetailsById(req.params.key_id);

            if (!details) {
                return res.status(404).json({ detail: 'API Key not found' });
            }

            res.json(details);
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    router.patch('/:key_id/activate', requireRegularKeyForOwnServerKeys(db), (req, res) => {
        try {
            const keyId = req.params.key_id;

            if (!db.getApiKeyDetailsById(keyId)) {
                return res.status(404).json({ detail: 'Key not found' });
            }

            if (db.toggleApiKeyActivation(keyId, true)) {
                return res.json({ message: `Key '${keyId}' activated.` });
            }

            res.status(500).json({ detail: 'Failed to activate key.' });
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    router.patch('/:key_id/deactivate', requireRegularKeyForOwnServerKeys(db), (req, res) => {
        try {
            const keyId = req.params.key_id;
            const keyInfo = db.getApiKeyDetailsById(keyId);

            if (!keyInfo) {
                return res.status(404).json({ detail: 'Key not found' });
            }

            // 不能删除自己
            if (keyId === req.apiKey.id) {
                return res.status(400).json({ detail: 'Cannot deactivate your own key.' });
            }

            // 管理员不能删除最后一个Admin Key
            if (req.apiKey.keyType === KEY_TYPE_ADMIN && keyInfo.keyType === KEY_TYPE_ADMIN) {
                const allKeys = db.getAllApiKeysInfo();
                const activeAdmin = allKeys.filter(k => k.keyType === KEY_TYPE_ADMIN && k.isActive && k.id !== keyId);

                if (activeAdmin.length === 0) {
                    return res.status(400).json({ detail: 'Cannot deactivate last active Admin Key.' });
                }
            }

            if (db.toggleApiKeyActivation(keyId, false)) {
                return res.json({ message: `Key '${keyId}' deactivated.` });
            }

            res.status(500).json({ detail: 'Failed to deactivate key.' });
        } catch (error) {
            res.status(500).json({ detail: error.message });
        }
    });

    router.delete('/:key_id', requireRegularKeyForOwnServerKeys(db), (req, res) => {
        try {
            const keyId = req.params.key_id;

            if (!db.getApiKeyDetailsById(keyId)) {
                return res.status(404).json({ detail: 'Key not found' });
            }

            // 不能删除自己
            if (keyId === req.apiKey.id) {
                return res.status(400).json({ detail: 'Cannot delete your own key.' });
            }

            db.deleteApiKeyById(keyId);
            res.status(204).send();
        } catch (error) {
            if (error.message.includes('last Admin Key')) {
                return res.status(400).json({ detail: error.message });
            }
            res.status(500).json({ detail: error.message });
        }
    });

    return router;
}

module.exports = createKeysRouter;
