# InterConnect-Server

一个用于Minecraft服务器的实时WebSocket API服务器，提供事件通信、密钥管理和Web控制面板，连接Minecraft与外部世界。

## 功能特性

- ✅ RESTful API (Express)
- ✅ WebSocket实时通信
- ✅ 三层权限密钥系统
- ✅ SQLite数据库存储
- ✅ Web控制面板
- ✅ CLI管理工具
- ✅ Docker支持

## 三层权限系统

| 密钥类型 | 前缀 | 权限 | 用途 |
|---------|------|------|------|
| **Admin Key** | `mc_admin_` | 👑 最高权限 | 管理所有密钥和系统配置 |
| **Regular Key** | `mc_key_` | 🔑 服务器管理 | 登录控制面板，管理关联的Server Key，发送命令 |
| **Server Key** | `mc_server_` | 🖥️ 插件配置 | 用于Minecraft插件/mod的配置文件 |

### 密钥关联关系

- **Admin Key**可以创建任何类型的密钥
- **创建Regular Key时会自动生成一个关联的Server Key**
- **Regular Key**可以管理自己关联的Server Key（查看、激活、停用、删除）
- **只有Admin Key才可以为Regular Key创建多个Server Key**
- **Regular Key不能为自己创建Server Key**，但可以重建自己的Server Key（通过Admin操作）
- **Server Key**仅用于插件配置，不能登录控制面板

### 典型使用流程

1. Admin Key创建Regular Key → 自动生成关联的Server Key
2. Regular Key用于登录控制面板
3. Server Key用于Minecraft插件配置
4. Regular Key可以在控制面板管理所有关联的Server Key
5. 需要新的Server Key时，联系Admin创建
6. Regular Key可以请求Admin删除旧的Server Key，创建新的Server Key（重建）

## 快速开始

### 方式一：直接运行

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```bash
start-server.bat
```

首次启动会自动生成Admin Key，请保存控制台输出的密钥。

### 方式二：Docker部署

```bash
# Docker Compose（推荐）
docker-compose up -d

# 或使用Docker
docker build -t minecraft-ws-api .
docker run -d -p 8000:8000 -v $(pwd)/data:/data minecraft-ws-api
```

## 访问地址

| 服务 | 地址 |
|------|------|
| API根路径 | http://localhost:8000 |
| Web控制面板 | http://localhost:8000/dashboard |
| WebSocket | ws://localhost:8000/ws |
| 健康检查 | http://localhost:8000/health |

## API端点

### 密钥管理（需要Admin Key）

```
POST   /manage/keys              创建密钥
GET    /manage/keys              列出所有密钥
GET    /manage/keys/:id          获取密钥详情
PATCH  /manage/keys/:id/activate 激活密钥
PATCH  /manage/keys/:id/deactivate 停用密钥
DELETE /manage/keys/:id          删除密钥
```

**创建密钥请求示例：**
```json
{
  "name": "MyServer",
  "description": "我的服务器",
  "key_type": "server",
  "server_id": "server-001"
}
```

key_type可选值：`admin`、`server`、`regular`

### 事件接收（需要任意密钥）

```
POST /api/events
```

**请求示例：**
```json
{
  "event_type": "player_join",
  "server_name": "MyServer",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "player": "Steve",
    "uuid": "xxx-xxx-xxx"
  }
}
```

### WebSocket连接

```
ws://localhost:8000/ws?api_key=YOUR_KEY
```

## CLI工具

```bash
# 创建普通密钥
node cli/cli.js create-key "MyServer"

# 创建Server密钥
node cli/cli.js create-key "MyServer" --type server

# 创建Admin密钥
node cli/cli.js create-key "AdminKey" --type admin

# 列出所有密钥
node cli/cli.js list-keys

# 查看密钥详情
node cli/cli.js get-key <key_id>

# 激活/停用密钥
node cli/cli.js activate-key <key_id>
node cli/cli.js deactivate-key <key_id>

# 删除密钥
node cli/cli.js delete-key <key_id>

# 健康检查
node cli/cli.js health

# 生成Minecraft插件配置
node cli/cli.js generate-config
```

## 环境配置

编辑 `.env` 文件：

```env
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DATABASE_PATH=minecraft_ws.db
DEBUG=true
```

## 项目结构

```
InterConnectServer-Node/
├── src/
│   ├── server.js           # 主服务器
│   ├── database.js         # 数据库管理
│   ├── auth.js             # 认证中间件
│   ├── websocket.js        # WebSocket管理
│   └── routes/
│       ├── keys.js         # 密钥管理路由
│       ├── events.js       # 事件路由
│       └── health.js       # 健康检查路由
├── cli/
│   └── cli.js              # CLI工具
├── dashboard/
│   └── public/             # 控制面板前端
├── Dockerfile
├── docker-compose.yml
├── start.sh                # Linux启动脚本
├── start-server.bat        # Windows启动脚本
└── package.json
```

## 技术栈

- **Express** - Web框架
- **ws** - WebSocket库
- **sql.js** - SQLite数据库
- **bcryptjs** - 密码哈希
- **commander** - CLI框架

## 安全提示

- 请妥善保管Admin Key，它拥有完全的管理权限
- 生产环境请使用HTTPS和WSS协议
- 定期备份数据库文件
- 不要在代码中硬编码密钥

## 许可证

MIT
