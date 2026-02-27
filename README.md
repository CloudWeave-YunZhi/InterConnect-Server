# InterConnect-Server

游戏服务器互联中继，基于 WebSocket + Express，支持多节点注册、消息广播/转发、管理面板鉴权。

---

## 环境要求

- Node.js 18+


---

## 快速开始

```bash
npm install

# 首次运行前设置 admin 密码
npm run start set-admin <password>

# 启动服务
npm run start serve
```
或者使用docker
```bash
docker run -d \
  --name interconnect-server \ #容器名字
  -p 8000:8000 \ #暴露8000端口
  -v $(pwd)/data:/app/data \ #挂载数据目录
  fasfuah/interconnect-server:latest
```
---


## CLI

```bash
# 启动服务
npm run start serve

# 设置 / 修改 admin 密码
npm run start set-admin <password>

# 添加节点（返回 UUID 和 Token）
npm run start add-node <servername>

# 列出所有节点
npm run start list-nodes

# 删除节点
npm run start del-node <servername>
```

---

## REST API

### 登录

```
POST /login
Content-Type: application/json

{ "password": "your_admin_password" }
```

成功返回 Bearer Token，有效期 1 小时：
```json
{ "success": true, "token": "..." }
```

---

### 管理端点（需要鉴权）

所有 `/manager/*` 端点需要在请求头携带以下之一：

```
Authorization: Bearer <session_token>   # 登录后获取
X-Admin-Token: <password_sha256>        # 脚本直连用
```

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/manager/keys` | 列出所有节点 |
| `POST` | `/manager/keys/:servername` | 创建或重置节点凭据 |
| `DELETE` | `/manager/keys/:servername` | 删除节点 |
| `POST` | `/manager/kick/:servername` | 强制断开节点连接 |

`POST /manager/keys/:servername` 返回：
```json
{
  "success": true,
  "data": {
    "uuid": "...",
    "token": "..."
  }
}
```

---

## WebSocket 节点接入

连接地址：`ws://<host>/ws`

握手时通过请求头传入凭据：

```
x-uuid: <node_uuid>
x-token: <node_token>
```

### 消息格式

所有消息均为 JSON。

**发送消息：**
```json
{
  "type": "player_message",
  "targetId": "all",
  "msg": {
    "playerName": "Steve",
    "text": "Hello"
  }
}
```

`targetId` 可以是 `"all"`（广播给所有在线节点）或某个具体节点的 UUID。

**支持的事件类型：**
- `player_join`
- `player_quit`
- `player_death`
- `player_chat`
- `player_message`

**收到转发的消息格式：**
```json
{
  "fromId": "source_node_uuid",
  "fromName": "source_node_name",
  "type": "player_message",
  "msg": { ... },
  "time": 1708300000000
}
```

---

## 数据库

SQLite，文件位于 `./data/app.db`，启动时自动创建。

| 表 | 说明 |
|---|---|
| `system_config` | admin 密码等系统配置 |
| `nodes` | 节点注册信息和在线状态 |
| `hits` | 由express-rate-limit自动创建的 |
