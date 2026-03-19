import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationTestContext } from './helpers/integrationTestContext.ts';

const ctx = setupIntegrationTestContext();

async function loginAndGetSessionToken() {
    const loginRes = await request(ctx.getBaseUrl())
        .post('/login')
        .send({ password: ctx.getAdminPassword() });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(typeof loginRes.body.token).toBe('string');
    return loginRes.body.token as string;
}

describe('HTTP routes', () => {
    it('POST /login should return token when password is valid', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/login')
            .send({ password: ctx.getAdminPassword() });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.token).toBe('string');
    });

    it('POST /login should return 401 when password is invalid', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/login')
            .send({ password: 'wrong-password' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Manager routes auth coverage', () => {
    it('GET /manager/keys should reject wrong admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .get('/manager/keys')
            .set('x-admin-token', 'wrong-admin-token');

        expect(res.status).toBe(401);
    });

    it('GET /manager/keys should accept correct admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .get('/manager/keys')
            .set('x-admin-token', ctx.getAdminPassword());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /manager/keys should accept token from /login', async () => {
        const sessionToken = await loginAndGetSessionToken();
        const res = await request(ctx.getBaseUrl())
            .get('/manager/keys')
            .set('authorization', `Bearer ${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /manager/keys/:servername should reject wrong admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-create-bad-key')
            .set('x-admin-token', 'wrong-admin-token');

        expect(res.status).toBe(401);
    });

    it('POST /manager/keys/:servername should accept correct admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-create-good-key')
            .set('x-admin-token', ctx.getAdminPassword());

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.data.uuid).toBe('string');
        expect(typeof res.body.data.token).toBe('string');
    });

    it('POST /manager/keys/:servername should accept token from /login', async () => {
        const sessionToken = await loginAndGetSessionToken();
        const res = await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-create-login-token')
            .set('authorization', `Bearer ${sessionToken}`);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.data.uuid).toBe('string');
        expect(typeof res.body.data.token).toBe('string');
    });

    it('DELETE /manager/keys/:servername should reject wrong admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .delete('/manager/keys/test-node-delete-bad-key')
            .set('x-admin-token', 'wrong-admin-token');

        expect(res.status).toBe(401);
    });

    it('DELETE /manager/keys/:servername should accept correct admin key', async () => {
        await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-delete-good-key')
            .set('x-admin-token', ctx.getAdminPassword());

        const res = await request(ctx.getBaseUrl())
            .delete('/manager/keys/test-node-delete-good-key')
            .set('x-admin-token', ctx.getAdminPassword());

        expect(res.status).toBe(200);
        expect(typeof res.body.msg).toBe('string');
    });

    it('DELETE /manager/keys/:servername should accept token from /login', async () => {
        await request(ctx.getBaseUrl())
            .post('/manager/keys/test-node-delete-login-token')
            .set('x-admin-token', ctx.getAdminPassword());

        const sessionToken = await loginAndGetSessionToken();
        const res = await request(ctx.getBaseUrl())
            .delete('/manager/keys/test-node-delete-login-token')
            .set('authorization', `Bearer ${sessionToken}`);

        expect(res.status).toBe(200);
        expect(typeof res.body.msg).toBe('string');
    });

    it('POST /manager/kick/:servername should reject wrong admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/manager/kick/test-node-kick-bad-key')
            .set('x-admin-token', 'wrong-admin-token');

        expect(res.status).toBe(401);
    });

    it('POST /manager/kick/:servername should accept correct admin key', async () => {
        const res = await request(ctx.getBaseUrl())
            .post('/manager/kick/test-node-kick-good-key')
            .set('x-admin-token', ctx.getAdminPassword());

        expect(res.status).toBe(200);
        expect(typeof res.body.msg).toBe('string');
    });

    it('POST /manager/kick/:servername should accept token from /login', async () => {
        const sessionToken = await loginAndGetSessionToken();
        const res = await request(ctx.getBaseUrl())
            .post('/manager/kick/test-node-kick-login-token')
            .set('authorization', `Bearer ${sessionToken}`);

        expect(res.status).toBe(200);
        expect(typeof res.body.msg).toBe('string');
    });
});
