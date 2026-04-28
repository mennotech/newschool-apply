import { http, HttpResponse } from 'msw';

const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

export const handlers = [
  http.post(`${BASE_URL}/user/login`, () => {
    return HttpResponse.json({
      current_user: {
        uid: 1,
        name: 'testuser',
        mail: 'test@test.com',
        roles: ['authenticated'],
      },
      logout_token: 'test-logout-token',
      csrf_token: 'test-csrf',
    });
  }),

  http.get(`${BASE_URL}/user/logout`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${BASE_URL}/user/login_status`, () => {
    return HttpResponse.json(1);
  }),

  http.get(`${BASE_URL}/session/token`, () => {
    return new HttpResponse('test-csrf-token', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }),

  http.get(`${BASE_URL}/api/session/info`, () => {
    return HttpResponse.json({
      logout_token: 'test-logout-token',
      current_user: {
        uid: 1,
        name: 'testuser',
        mail: 'test@test.com',
        roles: ['authenticated'],
      },
    });
  }),

  http.get(`${BASE_URL}/jsonapi/node/application`, () => {
    return HttpResponse.json({ data: [] });
  }),
];
