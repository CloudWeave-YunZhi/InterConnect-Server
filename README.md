# InterConnect-Server

Minecraft InterConnect 服务端，提供 WebSocket 实时消息转发、节点管理与管理端鉴权能力。

---

## 环境要求

- Node.js 22+

---

## 快速开始

```bash
cd server
npm install
npm run build

# 首次运行先设置 admin 密码
npm run start -- set-admin <password>

# 启动服务
npm run start -- serve
```

---

## Docker（前后端分离）

### 本地构建镜像（按仓库 Dockerfile）

```bash
# API 镜像（docker/api.Dockerfile）
docker build -f docker/api.Dockerfile -t fasfuah/interconnect-server:local .

# UI 镜像（docker/nginx/Dockerfile）
docker build -f docker/nginx/Dockerfile -t interconnect-server-ui:local .
```

### 1) 启动 API（`fasfuah/interconnect-server`）

```bash
docker network create interconnect-net

docker run -d \
  --name interconnect-server \
  --network interconnect-net \
  -p 8000:8000 \
  -v ./data:/app/data \
  fasfuah/interconnect-server:latest
```

### 2) 准备 Nginx 配置目录（挂载出去）

先在宿主机准备目录并放入 `default.conf`：

```bash
mkdir -p ./deploy/nginx/conf.d
cp ./docker/nginx/default.conf ./deploy/nginx/conf.d/default.conf
```

如果是前后端分离部署，请把 `default.conf` 里的：

```nginx
proxy_pass http://127.0.0.1:8000;
```

改成容器名（同一 Docker 网络）：

```nginx
proxy_pass http://interconnect-server:8000;
```

### 3) 启动 UI（`interconnect-server-ui`）

```bash
docker run -d \
  --name interconnect-server-ui \
  --network interconnect-net \
  -p 80:80 \
  -v ./deploy/nginx/conf.d:/etc/nginx/conf.d:ro \
  interconnect-server-ui:latest
```

可选环境变量：

- `PANEL_BASE_PATH`：管理面板路径前缀（默认 `/admin`，构建镜像时生效）。

---

## 开发脚本（server/package.json）

在 `server` 目录执行：

```bash
npm run dev          # 本地开发（tsx watch）
npm run build        # TypeScript 构建
npm run start -- ... # 启动 CLI 子命令
npm run test         # 运行测试
npm run test:watch   # 测试监听
npm run eslint       # 代码检查
npm run eslint:fix   # 自动修复 lint 问题
```

---

## CLI

```bash
# 启动服务
npm run start -- serve

# 设置 / 修改 admin 密码
npm run start -- set-admin <password>

# 创建或重置节点（返回 UUID 和 Token）
npm run start -- add-node <servername>

# 列出所有节点
npm run start -- list-nodes

# 删除节点
npm run start -- del-node <servername>
```

---

## REST API

### 登录

```
POST /login
Content-Type: application/json

{ "password": "your_admin_password" }
```

成功返回 Bearer Token（有效期 1 小时）：

```json
{ "success": true, "token": "..." }
```

### 管理接口（需鉴权）

所有 `/manager/*` 端点需要在请求头携带以下之一：

```
Authorization: Bearer <session_token>
X-Admin-Token: <password_sha256>
```

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/manager/keys` | 列出所有节点 |
| `POST` | `/manager/keys/:servername` | 创建或重置节点凭据 |
| `DELETE` | `/manager/keys/:servername` | 删除节点 |
| `POST` | `/manager/kick/:servername` | 强制断开节点连接 |

`POST /manager/keys/:servername` 返回示例：

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

发送消息示例：

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

`targetId` 可以是 `"all"`（广播）或指定节点 UUID。

支持事件类型：

- `player_join`
- `player_quit`
- `player_death`
- `player_chat`
- `player_message`

接收转发消息示例：

```json
{
  "fromId": "source_node_uuid",
  "fromName": "source_node_name",
  "type": "player_message",
  "msg": {},
  "time": 1708300000000
}
```

---

## 数据存储

使用 SQLite，默认文件：`./data/app.db`（启动时自动创建）。

| 表 | 说明 |
|---|---|
| `system_config` | 系统配置（如 admin 密码） |
| `nodes` | 节点注册信息与在线状态 |
| `hits` | 速率限制相关数据 |
