import { rest } from 'msw';

const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

export const handlers = [
  // CSRF token
  rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.text('mock-csrf-token'));
  }),

  // User login
  rest.post(`${BASE_URL}/user/login`, async (req, res, ctx) => {
    const body = await req.json();
    if (body.name === 'validuser' && body.pass === 'validpass') {
      return res(
        ctx.status(200),
        ctx.json({ current_user: { uid: '1', name: 'validuser' }, csrf_token: 'mock-csrf-token' })
      );
    }
    return res(
      ctx.status(403),
      ctx.json({ message: 'Unrecognized username or password.' })
    );
  }),

  // Note: /user/me does not exist in Drupal 10. Session restore uses sessionStorage.

  // User logout
  rest.post(`${BASE_URL}/user/logout`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Create student profile
  rest.post(`${BASE_URL}/jsonapi/node/student_profile`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'mock-student-profile-id',
          type: 'node--student_profile',
          attributes: body.data.attributes,
        },
      })
    );
  }),

  // Create application
  rest.post(`${BASE_URL}/jsonapi/node/application`, async (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'mock-application-id',
          type: 'node--application',
          attributes: { field_status: 'pending' },
        },
      })
    );
  }),

  // Submit application (PATCH)
  rest.patch(`${BASE_URL}/jsonapi/node/application/:id`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(200),
      ctx.json({
        data: {
          id: req.params.id,
          type: 'node--application',
          attributes: { ...body.data.attributes },
        },
      })
    );
  }),

  // File upload
  rest.post(`${BASE_URL}/jsonapi/node/document/field_file`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'mock-file-id',
          type: 'file--file',
          attributes: { filename: 'transcript.pdf', uri: { value: 'public://transcript.pdf' } },
        },
      })
    );
  }),

  // Create document node
  rest.post(`${BASE_URL}/jsonapi/node/document`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        data: {
          id: 'mock-document-id',
          type: 'node--document',
          attributes: body.data.attributes,
          relationships: body.data.relationships,
        },
      })
    );
  }),

  // List applications
  rest.get(`${BASE_URL}/jsonapi/node/application`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: [] }));
  }),

  // Fetch single application (with optional include)
  rest.get(`${BASE_URL}/jsonapi/node/application/:id`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        data: {
          id: req.params.id,
          type: 'node--application',
          attributes: { field_status: 'submitted', created: 1700000000 },
          relationships: { field_student_profile: { data: null } },
        },
        included: [],
      })
    );
  }),

  // List documents filtered by application
  rest.get(`${BASE_URL}/jsonapi/node/document`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: [] }));
  }),
];
