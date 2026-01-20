class ConnectionManager {
    constructor() {
        this.activeConnections = new Map();
        this.connectionKeys = new Map();
    }

    connect(websocket, apiKeyId) {
        if (!this.activeConnections.has(apiKeyId)) {
            this.activeConnections.set(apiKeyId, new Set());
        }
        this.activeConnections.get(apiKeyId).add(websocket);
        this.connectionKeys.set(websocket, apiKeyId);
    }

    disconnect(websocket) {
        const apiKeyId = this.connectionKeys.get(websocket);
        
        if (apiKeyId && this.activeConnections.has(apiKeyId)) {
            this.activeConnections.get(apiKeyId).delete(websocket);
            
            if (this.activeConnections.get(apiKeyId).size === 0) {
                this.activeConnections.delete(apiKeyId);
            }
        }
        
        this.connectionKeys.delete(websocket);
    }

    async broadcastToAll(message) {
        if (this.activeConnections.size === 0) return;
        
        const messageStr = JSON.stringify(message);
        const disconnectedWebsockets = [];
        
        for (const connectionsSet of this.activeConnections.values()) {
            for (const connection of connectionsSet) {
                try {
                    if (connection.readyState === 1) {
                        connection.send(messageStr);
                    } else {
                        disconnectedWebsockets.push(connection);
                    }
                } catch (error) {
                    disconnectedWebsockets.push(connection);
                }
            }
        }
        
        for (const ws of disconnectedWebsockets) {
            this.disconnect(ws);
        }
    }

    getActiveConnectionsCount() {
        let count = 0;
        for (const connectionsSet of this.activeConnections.values()) {
            count += connectionsSet.size;
        }
        return count;
    }
}

module.exports = ConnectionManager;
