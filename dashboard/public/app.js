const API_URL = window.location.origin;
let superKey = null;
let ws = null;

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const createKeyBtn = document.getElementById('create-key-btn');
const createKeyModal = document.getElementById('create-key-modal');
const createKeyForm = document.getElementById('create-key-form');
const cancelCreateBtn = document.getElementById('cancel-create-btn');
const keyDetailsModal = document.getElementById('key-details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('super-key-input').value;
    
    try {
        // 验证密钥是否有效
        const response = await fetch(`${API_URL}/health`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        
        if (response.ok) {
            superKey = key;
            
            // 验证密钥类型
            let userKeyType = null;
            let userServerId = null;
            
            // 尝试Admin Key验证
            const adminResponse = await fetch(`${API_URL}/manage/keys`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            
            if (adminResponse.ok) {
                userKeyType = 'admin';
            } else {
                // 尝试Server Key验证
                const serverResponse = await fetch(`${API_URL}/api/server/info`, {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                
                if (serverResponse.ok) {
                    userKeyType = 'server';
                    const serverData = await serverResponse.json();
                    userServerId = serverData.server_id;
                } else {
                    // 尝试Regular Key验证（获取自己的Server Key列表）
                    const regularResponse = await fetch(`${API_URL}/manage/keys/server-keys`, {
                        headers: { 'Authorization': `Bearer ${key}` }
                    });
                    
                    if (regularResponse.ok) {
                        userKeyType = 'regular';
                    } else {
                        throw new Error('无效的密钥或权限不足');
                    }
                }
            }
            
            loginError.textContent = '';
            showDashboard(userKeyType, userServerId);
        } else {
            loginError.textContent = '无效的密钥';
        }
    } catch (error) {
        loginError.textContent = error.message || '无法连接到服务器';
    }
});

logoutBtn.addEventListener('click', () => {
    superKey = null;
    if (ws) {
        ws.close();
        ws = null;
    }
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
});

createKeyBtn.addEventListener('click', () => {
    createKeyModal.classList.remove('hidden');
});

cancelCreateBtn.addEventListener('click', () => {
    createKeyModal.classList.add('hidden');
    createKeyForm.reset();
});

closeDetailsBtn.addEventListener('click', () => {
    keyDetailsModal.classList.add('hidden');
});

createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('key-name').value;
    const description = document.getElementById('key-description').value;
    const isSuper = document.getElementById('key-is-super').checked;
    
    try {
        const response = await fetch(`${API_URL}/manage/keys`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${superKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                description,
                is_super_key: isSuper
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            createKeyModal.classList.add('hidden');
            createKeyForm.reset();
            
            showKeyCreatedModal(result);
            loadKeys();
        } else {
            const error = await response.json();
            alert('创建失败: ' + error.detail);
        }
    } catch (error) {
        alert('创建失败: ' + error.message);
    }
});

function showKeyCreatedModal(keyData) {
    const content = `
        <p><strong>密钥创建成功！</strong></p>
        <p>名称: ${keyData.name}</p>
        <p>类型: ${keyData.isSuperKey ? 'SuperKey' : '普通密钥'}</p>
        <div class="key-display">
            <strong>⚠️ 请立即复制并保存此密钥（仅显示一次）:</strong><br>
            ${keyData.key}
        </div>
    `;
    
    document.getElementById('key-details-content').innerHTML = content;
    keyDetailsModal.classList.remove('hidden');
}

// 全局变量
let currentUserKeyType = null;
let currentUserServerId = null;

async function showDashboard(userKeyType, userServerId) {
    currentUserKeyType = userKeyType;
    currentUserServerId = userServerId;
    
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    // 显示用户信息
    const userInfo = document.getElementById('user-info');
    const keyTypeIcons = { admin: '👑', server: '🖥️', regular: '🔑' };
    const keyTypeNames = { admin: 'Admin', server: 'Server', regular: 'Regular' };
    userInfo.textContent = `${keyTypeIcons[userKeyType]} ${keyTypeNames[userKeyType]} 用户`;
    
    // 根据权限显示/隐藏功能
    const adminSection = document.getElementById('admin-section');
    const serverSection = document.getElementById('server-section');
    
    if (userKeyType === 'admin') {
        adminSection.style.display = 'block';
        serverSection.style.display = 'block';
        loadKeys();
    } else if (userKeyType === 'server') {
        adminSection.style.display = 'none';
        serverSection.style.display = 'block';
        loadServerInfo();
    } else if (userKeyType === 'regular') {
        adminSection.style.display = 'none';
        serverSection.style.display = 'block';
        loadRegularServerKeys();
    }
    
    // 根据用户类型控制创建密钥按钮的显示
    const createKeyBtn = document.getElementById('create-key-btn');
    if (createKeyBtn) {
        createKeyBtn.style.display = userKeyType === 'admin' ? 'block' : 'none';
    }
    
    loadStats();
    connectWebSocket();
    
    setInterval(loadStats, 5000);
}

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        document.getElementById('stat-connections').textContent = data.active_ws || 0;
        document.getElementById('stat-total-keys').textContent = data.keys_total || 0;
        document.getElementById('stat-super-keys').textContent = data.super_active || 0;
        document.getElementById('stat-regular-keys').textContent = data.regular_active || 0;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadKeys() {
    try {
        const response = await fetch(`${API_URL}/manage/keys`, {
            headers: { 'Authorization': `Bearer ${superKey}` }
        });
        
        if (response.ok) {
            const keys = await response.json();
            renderKeys(keys);
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

async function loadRegularServerKeys() {
    try {
        const response = await fetch(`${API_URL}/manage/keys/server-keys`, {
            headers: { 'Authorization': `Bearer ${superKey}` }
        });
        
        if (response.ok) {
            const serverKeys = await response.json();
            renderServerKeys(serverKeys);
        } else {
            document.getElementById('keys-list').innerHTML = '<p>无法加载Server Key列表</p>';
        }
    } catch (error) {
        console.error('Failed to load server keys:', error);
        document.getElementById('keys-list').innerHTML = '<p>无法加载Server Key列表</p>';
    }
}

function renderServerKeys(keys) {
    const keysList = document.getElementById('keys-list');
    
    if (keys.length === 0) {
        keysList.innerHTML = '<p>暂无关联的Server Key</p>';
        return;
    }
    
    keysList.innerHTML = keys.map(key => `
        <div class="key-card">
            <div class="key-info">
                <h3>
                    <span class="key-badge server">🖥️ Server</span>
                    <span class="key-badge ${key.isActive ? 'active' : 'inactive'}">
                        ${key.isActive ? '活跃' : '已停用'}
                    </span>
                    ${key.name}
                </h3>
                <p>ID: ${key.id}</p>
                <p>前缀: ${key.keyPrefix}</p>
                ${key.serverId ? `<p>服务器ID: ${key.serverId}</p>` : ''}
                <p>创建时间: ${new Date(key.createdAt).toLocaleString('zh-CN')}</p>
                <p>最后使用: ${key.lastUsed ? new Date(key.lastUsed).toLocaleString('zh-CN') : '从未使用'}</p>
            </div>
            <div class="key-actions">
                ${key.isActive ? 
                    `<button class="btn-danger" onclick="deactivateKey('${key.id}')">停用</button>` :
                    `<button class="btn-success" onclick="activateKey('${key.id}')">激活</button>`
                }
                <button class="btn-danger" onclick="deleteKey('${key.id}', '${key.name}')">删除</button>
            </div>
        </div>
    `).join('');
}

function renderKeys(keys) {
    const keysList = document.getElementById('keys-list');
    
    if (keys.length === 0) {
        keysList.innerHTML = '<p>暂无API密钥</p>';
        return;
    }
    
    keysList.innerHTML = keys.map(key => `
        <div class="key-card ${key.keyType === 'admin' ? 'super' : ''}">
            <div class="key-info">
                <h3>
                    <span class="key-badge ${key.keyType}">
                        ${key.keyType === 'admin' ? '👑 Admin' : key.keyType === 'server' ? '🖥️ Server' : '🔑 Regular'}
                    </span>
                    <span class="key-badge ${key.isActive ? 'active' : 'inactive'}">
                        ${key.isActive ? '活跃' : '已停用'}
                    </span>
                    ${key.name}
                </h3>
                <p>ID: ${key.id}</p>
                <p>前缀: ${key.keyPrefix}</p>
                ${key.serverId ? `<p>服务器ID: ${key.serverId}</p>` : ''}
                <p>创建时间: ${new Date(key.createdAt).toLocaleString('zh-CN')}</p>
                <p>最后使用: ${key.lastUsed ? new Date(key.lastUsed).toLocaleString('zh-CN') : '从未使用'}</p>
            </div>
            <div class="key-actions">
                ${key.isActive ? 
                    `<button class="btn-danger" onclick="deactivateKey('${key.id}')">停用</button>` :
                    `<button class="btn-success" onclick="activateKey('${key.id}')">激活</button>`
                }
                <button class="btn-danger" onclick="deleteKey('${key.id}', '${key.name}')">删除</button>
            </div>
        </div>
    `).join('');
}

async function activateKey(keyId) {
    try {
        const response = await fetch(`${API_URL}/manage/keys/${keyId}/activate`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${superKey}` }
        });
        
        if (response.ok) {
            if (currentUserKeyType === 'admin') {
                loadKeys();
            } else if (currentUserKeyType === 'regular') {
                loadRegularServerKeys();
            }
        } else {
            const error = await response.json();
            alert('激活失败: ' + error.detail);
        }
    } catch (error) {
        alert('激活失败: ' + error.message);
    }
}

async function deactivateKey(keyId) {
    try {
        const response = await fetch(`${API_URL}/manage/keys/${keyId}/deactivate`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${superKey}` }
        });
        
        if (response.ok) {
            if (currentUserKeyType === 'admin') {
                loadKeys();
            } else if (currentUserKeyType === 'regular') {
                loadRegularServerKeys();
            }
        } else {
            const error = await response.json();
            alert('停用失败: ' + error.detail);
        }
    } catch (error) {
        alert('停用失败: ' + error.message);
    }
}

async function deleteKey(keyId, keyName) {
    if (!confirm(`确定要删除密钥 "${keyName}" 吗？此操作无法撤销。`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/manage/keys/${keyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${superKey}` }
        });
        
        if (response.ok) {
            if (currentUserKeyType === 'admin') {
                loadKeys();
            } else if (currentUserKeyType === 'regular') {
                loadRegularServerKeys();
            }
        } else {
            const error = await response.json();
            alert('删除失败: ' + error.detail);
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

function connectWebSocket() {
    if (!superKey) return;
    
    const wsUrl = `ws://localhost:8000/ws?api_key=${superKey}`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'minecraft_event') {
                addEventToList(message.event);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(() => {
            if (superKey) {
                connectWebSocket();
            }
        }, 5000);
    };
    
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 30000);
}

function addEventToList(event) {
    const eventsList = document.getElementById('events-list');
    
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
        <strong>${event.event_type}</strong> - ${event.server_name}<br>
        <small>${new Date(event.timestamp).toLocaleString('zh-CN')}</small><br>
        <pre>${JSON.stringify(event.data, null, 2)}</pre>
    `;
    
    eventsList.insertBefore(eventItem, eventsList.firstChild);
    
    while (eventsList.children.length > 50) {
        eventsList.removeChild(eventsList.lastChild);
    }
}
