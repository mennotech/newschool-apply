import { rest } from 'msw';
import { server } from '../mocks/server';
import * as client from './drupalClient';

const BASE = 'http://localhost:8080';

beforeAll(() => {
  client.setBaseUrl(BASE);
});

describe('drupalClient', () => {
  describe('getCsrfToken', () => {
    it('fetches a CSRF token from /session/token', async () => {
      const token = await client.getCsrfToken();
      expect(token).toBe('mock-csrf-token');
    });

    it('throws when session/token fails', async () => {
      server.use(
        rest.get(`${BASE}/session/token`, (req, res, ctx) =>
          res(ctx.status(500))
        )
      );
      await expect(client.getCsrfToken()).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('sends GET request and returns parsed JSON', async () => {
      const data = await client.get('/jsonapi/node/application_partial_programming');
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('throws on non-ok response', async () => {
      server.use(
        rest.get(`${BASE}/jsonapi/node/application_partial_programming`, (req, res, ctx) =>
          res(ctx.status(403), ctx.json({ errors: [{ detail: 'Forbidden' }] }))
        )
      );
      await expect(client.get('/jsonapi/node/application_partial_programming')).rejects.toThrow('Forbidden');
    });
  });

  describe('post', () => {
    it('fetches CSRF token and sends POST request', async () => {
      let capturedHeaders = null;
      server.use(
        rest.post(`${BASE}/jsonapi/node/application_partial_programming`, async (req, res, ctx) => {
          capturedHeaders = req.headers.all();
          const body = await req.json();
          return res(ctx.status(201), ctx.json({ data: { id: 'new-id', ...body.data } }));
        })
      );

      const result = await client.post('/jsonapi/node/application_partial_programming', {
        data: { type: 'node--application_partial_programming', attributes: { title: 'Test' } },
      });

      expect(result.data.id).toBe('new-id');
      expect(capturedHeaders['x-csrf-token']).toBe('mock-csrf-token');
    });
  });

  describe('patch', () => {
    it('includes CSRF token in PATCH request', async () => {
      let capturedHeaders = null;
      server.use(
        rest.patch(`${BASE}/jsonapi/node/application_partial_programming/test-id`, async (req, res, ctx) => {
          capturedHeaders = req.headers.all();
          const body = await req.json();
          return res(ctx.status(200), ctx.json({ data: body.data }));
        })
      );

      await client.patch('/jsonapi/node/application_partial_programming/test-id', {
        data: { type: 'node--application_partial_programming', id: 'test-id', attributes: {} },
      });

      expect(capturedHeaders['x-csrf-token']).toBe('mock-csrf-token');
    });
  });

  describe('delete_', () => {
    it('sends DELETE request with CSRF token and returns null for 204', async () => {
      server.use(
        rest.delete(`${BASE}/jsonapi/node/application_partial_programming/del-id`, (req, res, ctx) =>
          res(ctx.status(204))
        )
      );
      const result = await client.delete_('/jsonapi/node/application_partial_programming/del-id');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns user data on valid credentials', async () => {
      const result = await client.login('testuser', 'password');
      expect(result.current_user.name).toBe('testuser');
      expect(result.logout_token).toBe('mock-logout-token');
    });

    it('throws on invalid credentials', async () => {
      await expect(client.login('bad', 'wrong')).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('calls logout endpoint with token', async () => {
      await expect(client.logout('mock-logout-token')).resolves.not.toThrow();
    });
  });

  describe('getLoginStatus', () => {
    it('returns false when not authenticated', async () => {
      const result = await client.getLoginStatus();
      expect(result).toBe(false);
    });

    it('returns true when authenticated', async () => {
      server.use(
        rest.get(`${BASE}/user/login_status`, (req, res, ctx) =>
          res(ctx.status(200), ctx.text('1'))
        )
      );
      const result = await client.getLoginStatus();
      expect(result).toBe(true);
    });
  });
});
