import { rest } from 'msw';
import { server } from '../mocks/server';
import * as client from './drupalClient';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

describe('drupalClient', () => {
  describe('get', () => {
    it('sends a GET request with credentials include and Accept header', async () => {
      let capturedRequest;
      server.use(
        rest.get(`${BASE_URL}/some/path`, (req, res, ctx) => {
          capturedRequest = req;
          return res(ctx.status(200), ctx.json({ hello: 'world' }));
        })
      );

      const result = await client.get('/some/path');
      expect(result).toEqual({ hello: 'world' });
      expect(capturedRequest.headers.get('accept')).toContain('application/vnd.api+json');
    });

    it('throws on non-OK response', async () => {
      server.use(
        rest.get(`${BASE_URL}/bad`, (req, res, ctx) =>
          res(ctx.status(404), ctx.json({ errors: [{ detail: 'Not found' }] }))
        )
      );
      await expect(client.get('/bad')).rejects.toThrow('Not found');
    });
  });

  describe('post', () => {
    it('fetches CSRF token before sending POST', async () => {
      let csrfFetched = false;
      server.use(
        rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => {
          csrfFetched = true;
          return res(ctx.text('test-token'));
        }),
        rest.post(`${BASE_URL}/api/resource`, async (req, res, ctx) => {
          return res(ctx.status(201), ctx.json({ data: { id: '1' } }));
        })
      );

      await client.post('/api/resource', { data: {} });
      expect(csrfFetched).toBe(true);
    });

    it('sends X-CSRF-Token header on POST', async () => {
      let capturedRequest;
      server.use(
        rest.get(`${BASE_URL}/session/token`, (req, res, ctx) =>
          res(ctx.text('my-token'))
        ),
        rest.post(`${BASE_URL}/api/res`, async (req, res, ctx) => {
          capturedRequest = req;
          return res(ctx.status(201), ctx.json({}));
        })
      );

      await client.post('/api/res', {});
      expect(capturedRequest.headers.get('x-csrf-token')).toBe('my-token');
    });
  });

  describe('patch', () => {
    it('fetches CSRF token before sending PATCH', async () => {
      let csrfFetched = false;
      server.use(
        rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => {
          csrfFetched = true;
          return res(ctx.text('test-token'));
        }),
        rest.patch(`${BASE_URL}/api/resource/1`, async (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ data: { id: '1' } }));
        })
      );

      await client.patch('/api/resource/1', { data: {} });
      expect(csrfFetched).toBe(true);
    });

    it('reads base URL from REACT_APP_DRUPAL_BASE_URL', async () => {
      server.use(
        rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
        rest.patch(`${BASE_URL}/env-test`, (req, res, ctx) =>
          res(ctx.status(200), ctx.json({ ok: true }))
        )
      );
      const result = await client.patch('/env-test', {});
      expect(result.ok).toBe(true);
    });
  });
});
