const { KEY_TYPE_ADMIN, KEY_TYPE_SERVER, KEY_TYPE_REGULAR } = require('./database');

function verifyApiKey(db) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ detail: 'Invalid API Key' });
        }
        
        const token = authHeader.substring(7);
        const result = await db.verifyApiKey(token);
        
        if (!result) {
            return res.status(401).json({ detail: 'Invalid API Key' });
        }
        
        req.apiKey = result;
        next();
    };
}

function requireAdminKey(req, res, next) {
    if (!req.apiKey || req.apiKey.keyType !== KEY_TYPE_ADMIN) {
        return res.status(403).json({ detail: 'Operation requires an Admin Key' });
    }
    next();
}

function requireRegularOrAdminKey(req, res, next) {
    if (!req.apiKey || (req.apiKey.keyType !== KEY_TYPE_ADMIN && req.apiKey.keyType !== KEY_TYPE_REGULAR)) {
        return res.status(403).json({ detail: 'Operation requires a Regular Key or Admin Key' });
    }
    next();
}

function requireRegularKeyForOwnServerKeys(db) {
    return async (req, res, next) => {
        requireRegularOrAdminKey(req, res, async () => {
            const keyId = req.params.key_id;
            const keyInfo = db.getApiKeyDetailsById(keyId);
            
            if (!keyInfo) {
                return res.status(404).json({ detail: 'Key not found' });
            }
            
            // Admin可以管理所有密钥
            if (req.apiKey.keyType === KEY_TYPE_ADMIN) {
                return next();
            }
            
            // Regular Key只能管理自己关联的Server Key
            if (req.apiKey.keyType === KEY_TYPE_REGULAR && keyInfo.regularKeyId === req.apiKey.id) {
                return next();
            }
            
            return res.status(403).json({ detail: 'Operation not permitted for this key' });
        });
    };
}

function requireServerKey(req, res, next) {
    if (!req.apiKey || (req.apiKey.keyType !== KEY_TYPE_ADMIN && req.apiKey.keyType !== KEY_TYPE_SERVER)) {
        return res.status(403).json({ detail: 'Operation requires a Server Key or Admin Key' });
    }
    next();
}

function requireAnyKey(req, res, next) {
    if (!req.apiKey) {
        return res.status(401).json({ detail: 'Authentication required' });
    }
    next();
}

module.exports = {
    verifyApiKey,
    requireAdminKey,
    requireServerKey,
    requireRegularOrAdminKey,
    requireRegularKeyForOwnServerKeys,
    requireAnyKey
};
