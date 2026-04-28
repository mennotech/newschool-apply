import { rest } from 'msw';

const BASE = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

const mockUser = {
  uid: '1',
  name: 'testuser',
  mail: 'test@example.com',
  roles: ['authenticated'],
};

const mockApplication = {
  id: 'app-uuid-1',
  type: 'node--application_partial_programming',
  attributes: {
    title: 'Test Application',
    field_application_status: 'draft',
    created: '2024-01-01T00:00:00+00:00',
    field_student_first_name: 'John',
    field_student_last_name: 'Doe',
    field_student_applying_for_grade: '5',
    field_submitted_at: null,
  },
  relationships: {
    field_student_profile: { data: null },
  },
};

export const handlers = [
  rest.get(`${BASE}/session/token`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.text('mock-csrf-token'));
  }),

  rest.get(`${BASE}/user/login_status`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.text('0'));
  }),

  rest.post(`${BASE}/user/login`, async (req, res, ctx) => {
    const body = await req.json();
    if (body.name === 'testuser' && body.pass === 'password') {
      return res(
        ctx.status(200),
        ctx.json({
          current_user: mockUser,
          logout_token: 'mock-logout-token',
          csrf_token: 'mock-csrf-token',
        })
      );
    }
    return res(
      ctx.status(400),
      ctx.json({ message: 'Sorry, unrecognized username or password.' })
    );
  }),

  rest.get(`${BASE}/user/logout`, (req, res, ctx) => {
    const token = req.url.searchParams.get('token');
    if (token) {
      return res(ctx.status(200), ctx.json({ message: 'Logged out successfully' }));
    }
    return res(ctx.status(403), ctx.json({ message: 'Forbidden' }));
  }),

  rest.post(`${BASE}/user/register`, async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ uid: [{ value: 2 }], name: [{ value: 'newuser' }] })
    );
  }),

  rest.get(`${BASE}/api/session/info`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        current_user: mockUser,
        logout_token: 'mock-logout-token',
      })
    );
  }),

  rest.get(`${BASE}/jsonapi/node/application_partial_programming`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        data: [mockApplication],
        meta: { count: 1 },
      })
    );
  }),

  rest.post(`${BASE}/jsonapi/node/application_partial_programming`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          ...mockApplication,
          id: 'new-app-uuid',
          attributes: { ...mockApplication.attributes, ...body.data.attributes },
        },
      })
    );
  }),

  rest.get(`${BASE}/jsonapi/node/application_partial_programming/:id`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: mockApplication }));
  }),

  rest.patch(`${BASE}/jsonapi/node/application_partial_programming/:id`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(200),
      ctx.json({
        data: {
          ...mockApplication,
          attributes: { ...mockApplication.attributes, ...body.data.attributes },
        },
      })
    );
  }),

  rest.delete(`${BASE}/jsonapi/node/application_partial_programming/:id`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  rest.get(`${BASE}/jsonapi/node/person`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: [] }));
  }),

  rest.post(`${BASE}/jsonapi/node/person`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'person-uuid-1',
          type: 'node--person',
          attributes: {
            title: 'Test Person',
            ...body.data.attributes,
          },
        },
      })
    );
  }),

  rest.get(`${BASE}/jsonapi/node/address`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: [] }));
  }),

  rest.post(`${BASE}/jsonapi/node/address`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'address-uuid-1',
          type: 'node--address',
          attributes: { title: '123 Main St', ...body.data.attributes },
        },
      })
    );
  }),

  rest.post(`${BASE}/api/payments/checkout-session`, async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        checkout_url: 'https://checkout.stripe.com/session/test',
        payment_id: 'pay-uuid-1',
      })
    );
  }),

  rest.get(`${BASE}/api/payments/checkout-status`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'paid', receipt_url: 'https://receipt.example.com' }));
  }),
];
