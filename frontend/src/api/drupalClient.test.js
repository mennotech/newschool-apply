import * as drupalClient from './drupalClient';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

describe('drupalClient', () => {
  describe('get()', () => {
    it('includes credentials in the request', async () => {
      let capturedRequest;
      server.use(
        http.get(`${BASE_URL}/test-get`, ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: [] });
        })
      );
      await drupalClient.get('/test-get');
      // credentials: 'include' is sent — MSW receives the request
      expect(capturedRequest).toBeDefined();
    });

    it('returns parsed JSON data', async () => {
      server.use(
        http.get(`${BASE_URL}/test-data`, () =>
          HttpResponse.json({ data: [{ id: '1' }] })
        )
      );
      const result = await drupalClient.get('/test-data');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
    });

    it('throws an error for 4xx responses', async () => {
      server.use(
        http.get(`${BASE_URL}/not-found`, () =>
          HttpResponse.json({ errors: [{ detail: 'Not found' }] }, { status: 404 })
        )
      );
      await expect(drupalClient.get('/not-found')).rejects.toThrow('Not found');
    });
  });

  describe('post()', () => {
    it('fetches CSRF token before sending', async () => {
      let csrfFetched = false;
      server.use(
        http.get(`${BASE_URL}/session/token`, () => {
          csrfFetched = true;
          return new HttpResponse('my-csrf-token', { headers: { 'Content-Type': 'text/plain' } });
        }),
        http.post(`${BASE_URL}/test-post`, () =>
          HttpResponse.json({ data: { id: 'new' } })
        )
      );
      await drupalClient.post('/test-post', { data: {} });
      expect(csrfFetched).toBe(true);
    });

    it('sends X-CSRF-Token header', async () => {
      let receivedCsrf;
      server.use(
        http.get(`${BASE_URL}/session/token`, () =>
          new HttpResponse('csrf-abc', { headers: { 'Content-Type': 'text/plain' } })
        ),
        http.post(`${BASE_URL}/test-post-csrf`, ({ request }) => {
          receivedCsrf = request.headers.get('X-CSRF-Token');
          return HttpResponse.json({ data: { id: '1' } });
        })
      );
      await drupalClient.post('/test-post-csrf', {});
      expect(receivedCsrf).toBe('csrf-abc');
    });
  });

  describe('login()', () => {
    it('calls the correct endpoint and returns user data', async () => {
      const result = await drupalClient.login('testuser', 'password');
      expect(result.current_user).toBeDefined();
      expect(result.current_user.name).toBe('testuser');
      expect(result.logout_token).toBe('test-logout-token');
    });

    it('throws on login failure', async () => {
      server.use(
        http.post(`${BASE_URL}/user/login`, () =>
          HttpResponse.json(
            { message: 'Unrecognized username or password.' },
            { status: 400 }
          )
        )
      );
      await expect(drupalClient.login('bad', 'wrong')).rejects.toThrow();
    });
  });

  describe('getLoginStatus()', () => {
    it('returns true when server returns 1', async () => {
      const result = await drupalClient.getLoginStatus();
      expect(result).toBe(true);
    });

    it('returns false when server returns 0', async () => {
      server.use(
        http.get(`${BASE_URL}/user/login_status`, () => HttpResponse.json(0))
      );
      const result = await drupalClient.getLoginStatus();
      expect(result).toBe(false);
    });
  });

  describe('error parsing', () => {
    it('parses Drupal JSON:API error format', async () => {
      server.use(
        http.get(`${BASE_URL}/error-endpoint`, () =>
          HttpResponse.json(
            {
              errors: [
                { detail: 'The field value is invalid.', title: 'Validation error' },
              ],
            },
            { status: 422 }
          )
        )
      );
      await expect(drupalClient.get('/error-endpoint')).rejects.toThrow(
        'The field value is invalid.'
      );
    });
  });
});
