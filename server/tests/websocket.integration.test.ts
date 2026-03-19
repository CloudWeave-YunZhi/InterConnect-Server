import request from 'supertest';
import WebSocket from 'ws';
import { describe, expect, it } from 'vitest';
import { setupIntegrationTestContext } from './helpers/integrationTestContext.ts';

const ctx = setupIntegrationTestContext();

function waitForHeartbeatPacket(ws: WebSocket, timeoutMs = 35000) {
    return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out waiting for heartbeat packet within ${timeoutMs}ms`));
        }, timeoutMs);

        const onMessage = (data: WebSocket.RawData) => {
            try {
                const packet = JSON.parse(data.toString());
                if (packet?.type === 'heartbeat') {
                    cleanup();
                    resolve(packet);
                }
            } catch {
                // Ignore non-JSON frames in this wait helper.
            }
        };

        const onError = (err: Error) => {
            cleanup();
            reject(err);
        };

        const cleanup = () => {
            clearTimeout(timer);
            ws.off('message', onMessage);
            ws.off('error', onError);
        };

        ws.on('message', onMessage);
        ws.on('error', onError);
    });
}

describe('WebSocket', () => {
    it('should reject websocket connection without auth headers', async () => {
        const ws = new WebSocket(`${ctx.getBaseUrl().replace('http', 'ws')}/ws`);
        const code = await ctx.waitForWsClose(ws);

        expect(code).toBe(1008);
    });

    it('should forward message from one node to another node', async () => {
        const nodeARes = await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-ws-a')
            .set('x-admin-token', ctx.getAdminPassword());

        const nodeBRes = await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-ws-b')
            .set('x-admin-token', ctx.getAdminPassword());

        const nodeA = nodeARes.body.data as { uuid: string; token: string };
        const nodeB = nodeBRes.body.data as { uuid: string; token: string };

        const wsA = await ctx.connectWs({
            'x-uuid': nodeA.uuid,
            'x-token': nodeA.token,
        });

        const wsB = await ctx.connectWs({
            'x-uuid': nodeB.uuid,
            'x-token': nodeB.token,
        });

        const receiveMessage = ctx.waitForWsMessage(wsB);

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
    });

    it(
        'should send heartbeat packet to authenticated websocket client',
        { timeout: 45000 },
        async () => {
            const nodeRes = await request(ctx.getBaseUrl())
                .post('/manager/keys/test-node-heartbeat')
                .set('x-admin-token', ctx.getAdminPassword());

            const node = nodeRes.body.data as { uuid: string; token: string };
            const ws = await ctx.connectWs({
                'x-uuid': node.uuid,
                'x-token': node.token,
            });

            const packet = await waitForHeartbeatPacket(ws);

            expect(packet.type).toBe('heartbeat');
            expect(packet.msg).toEqual({ status: 'ping' });
            expect(typeof packet.time).toBe('number');

            ws.close();
        }
    );
});
