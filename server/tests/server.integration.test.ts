import os from 'os';
import path from 'path';
import { mkdtempSync, rmSync } from 'fs';
import request from 'supertest';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type ServerModule = typeof import('../src/server.ts');

const ADMIN_PASSWORD = 'test-admin-password';

let originalCwd = '';
let tempDir = '';
let baseUrl = '';
let serverModule: ServerModule;
const openSockets = new Set<WebSocket>();

function connectWs(headers: Record<string, string>) {
    return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`, { headers });

        ws.once('open', () => {
            openSockets.add(ws);
            resolve(ws);
        });
        ws.once('error', reject);
    });
}

function waitForWsMessage(ws: WebSocket) {
    return new Promise<any>((resolve, reject) => {
        ws.once('message', (data) => {
            try {
                resolve(JSON.parse(data.toString()));
            } catch (err) {
                reject(err);
            }
        });
        ws.once('error', reject);
    });
}

function waitForWsClose(ws: WebSocket) {
    return new Promise<number>((resolve) => {
        ws.once('close', (code) => resolve(code));
    });
}

beforeAll(async () => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'interconnect-server-test-'));
    process.chdir(tempDir);

    const { config } = await import('../src/utils/initconfig.ts');
    config.server.addr = '127.0.0.1';
    config.server.port = 0;
    config.logger.enable = false;
    config.logger.pretty = false;

    const { updateAdminPasswd } = await import('../src/utils/genialtoken.ts');
    updateAdminPasswd(ADMIN_PASSWORD);

    serverModule = await import('../src/server.ts');
    await serverModule.startServer();

    const addr = serverModule.getHttpServer().address();
    if (!addr || typeof addr === 'string') {
        throw new Error('Failed to acquire server address');
    }

    baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
    await Promise.all(Array.from(openSockets).map((ws) => {
        return new Promise<void>((resolve) => {
            if (ws.readyState === WebSocket.CLOSED) {
                resolve();
                return;
            }
            ws.once('close', () => resolve());
            ws.close();
        });
    }));
    openSockets.clear();

    if (serverModule) {
        await serverModule.stopServer();
    }
    process.chdir(originalCwd);
    try {
        rmSync(tempDir, { recursive: true, force: true });
    } catch {
        // Ignore on Windows when sqlite lock release lags behind test teardown.
    }
});

describe('HTTP routes', () => {
    it('POST /login should return token when password is valid', async () => {
        const res = await request(baseUrl)
            .post('/login')
            .send({ password: ADMIN_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.token).toBe('string');
    });

    it('POST /login should return 401 when password is invalid', async () => {
        const res = await request(baseUrl)
            .post('/login')
            .send({ password: 'wrong-password' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('GET /manager/keys should reject unauthorized request', async () => {
        const res = await request(baseUrl).get('/manager/keys');

        expect(res.status).toBe(401);
    });

    it('manager routes should create and list node keys with admin token', async () => {
        const createRes = await request(baseUrl)
            .post('/manager/keys/test-node-a')
            .set('x-admin-token', ADMIN_PASSWORD);

        expect(createRes.status).toBe(201);
        expect(createRes.body.success).toBe(true);
        expect(typeof createRes.body.data.uuid).toBe('string');
        expect(typeof createRes.body.data.token).toBe('string');

        const listRes = await request(baseUrl)
            .get('/manager/keys')
            .set('x-admin-token', ADMIN_PASSWORD);

        expect(listRes.status).toBe(200);
        expect(listRes.body.success).toBe(true);
        expect(Array.isArray(listRes.body.data)).toBe(true);
        expect(listRes.body.data.some((node: any) => node.servername === 'test-node-a')).toBe(true);
    });
});

describe('WebSocket', () => {
    it('should reject websocket connection without auth headers', async () => {
        const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
        const code = await waitForWsClose(ws);

        expect(code).toBe(1008);
    });

    it('should forward message from one node to another node', async () => {
        const nodeARes = await request(baseUrl)
            .post('/manager/keys/test-node-ws-a')
            .set('x-admin-token', ADMIN_PASSWORD);

        const nodeBRes = await request(baseUrl)
            .post('/manager/keys/test-node-ws-b')
            .set('x-admin-token', ADMIN_PASSWORD);

        const nodeA = nodeARes.body.data as { uuid: string; token: string };
        const nodeB = nodeBRes.body.data as { uuid: string; token: string };

        const wsA = await connectWs({
            'x-uuid': nodeA.uuid,
            'x-token': nodeA.token,
        });

        const wsB = await connectWs({
            'x-uuid': nodeB.uuid,
            'x-token': nodeB.token,
        });

        const receiveMessage = waitForWsMessage(wsB);

        wsA.send(JSON.stringify({
            type: 'player_chat',
            targetId: nodeB.uuid,
            msg: { text: 'hello' },
        }));

        const packet = await receiveMessage;

        expect(packet.fromId).toBe(nodeA.uuid);
        expect(packet.fromName).toBe('test-node-ws-a');
        expect(packet.type).toBe('player_chat');
        expect(packet.msg).toEqual({ text: 'hello' });

        wsA.close();
        wsB.close();
        openSockets.delete(wsA);
        openSockets.delete(wsB);
    });
});
