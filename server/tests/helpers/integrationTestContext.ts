import os from 'os';
import path from 'path';
import { mkdtempSync, rmSync } from 'fs';
import WebSocket from 'ws';
import { afterAll, beforeAll } from 'vitest';

type ServerModule = typeof import('../../src/server.ts');

const ADMIN_PASSWORD = 'test-admin-password';

export function setupIntegrationTestContext() {
    let originalCwd = '';
    let tempDir = '';
    let baseUrl = '';
    let serverModule: ServerModule;
    const openSockets = new Set<WebSocket>();

    function getBaseUrl() {
        return baseUrl;
    }

    function getAdminPassword() {
        return ADMIN_PASSWORD;
    }

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

        const { config } = await import('../../src/utils/initconfig.ts');
        config.server.addr = '127.0.0.1';
        config.server.port = 0;
        config.logger.enable = false;
        config.logger.pretty = false;

        const { updateAdminPasswd } = await import('../../src/utils/genialtoken.ts');
        updateAdminPasswd(ADMIN_PASSWORD);

        serverModule = await import('../../src/server.ts');
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

    return {
        getBaseUrl,
        getAdminPassword,
        connectWs,
        waitForWsMessage,
        waitForWsClose,
    };
}
