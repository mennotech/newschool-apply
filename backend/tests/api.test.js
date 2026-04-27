/**
 * Backend API integration tests for newschool-apply.
 *
 * Tests CRUD operations via Drupal JSON:API for all three content types:
 *   - student_profile
 *   - application  (references student_profile)
 *   - document     (references application)
 *
 * Requirements:
 *   - Node 18+ (uses native fetch)
 *   - Drupal backend running (default: http://localhost:8080)
 *   - Admin credentials available via env vars or defaults
 *
 * Usage:
 *   node backend/tests/api.test.js
 *   BASE_URL=http://localhost:8080 ADMIN_USER=admin ADMIN_PASS=changeme node backend/tests/api.test.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';

// ---------------------------------------------------------------------------
// Minimal test harness (no external dependencies)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertExists(value, message) {
  if (value === undefined || value === null) {
    throw new Error(`${message} — value is ${value}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  return fn();
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Login and return { cookie, csrfToken } for subsequent requests.
 */
async function login(username, password) {
  const res = await fetch(`${BASE_URL}/user/login?_format=json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: username, pass: password }),
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No session cookie returned on login');

  // Extract the session cookie (SESS...)
  const cookie = setCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .join('; ');

  // Fetch a fresh CSRF token bound to this session
  const tokenRes = await fetch(`${BASE_URL}/session/token`, {
    headers: { Cookie: cookie },
  });
  if (!tokenRes.ok) throw new Error(`Failed to get CSRF token (${tokenRes.status})`);
  const csrfToken = await tokenRes.text();

  return { cookie, csrfToken };
}

function jsonApiHeaders(cookie, csrfToken) {
  return {
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
    Cookie: cookie,
    'X-CSRF-Token': csrfToken,
  };
}

async function jsonApiGet(path, cookie) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/vnd.api+json',
      Cookie: cookie,
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function jsonApiPost(path, payload, cookie, csrfToken) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: jsonApiHeaders(cookie, csrfToken),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function jsonApiPatch(path, payload, cookie, csrfToken) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: jsonApiHeaders(cookie, csrfToken),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function jsonApiDelete(path, cookie, csrfToken) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.api+json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken,
    },
  });
  return { status: res.status };
}

/**
 * Upload a raw file binary to a JSON:API file field endpoint.
 * Returns the file entity UUID on success.
 */
async function jsonApiFileUpload(path, filename, buffer, cookie, csrfToken) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `file; filename="${filename}"`,
      Accept: 'application/vnd.api+json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken,
    },
    body: buffer,
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function runAll() {
  console.log(`\nBackend API Integration Tests`);
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(50));

  // Shared auth state
  let cookie, csrfToken;

  // IDs created during tests — tracked so cleanup always runs
  let studentProfileId;
  let applicationId;
  let documentId;
  let uploadedFileId;

  // ------------------------------------------------------------------
  await describe('0. Authentication', async () => {
    await test('login with admin credentials returns session cookie and CSRF token', async () => {
      const session = await login(ADMIN_USER, ADMIN_PASS);
      assertExists(session.cookie, 'session cookie');
      assertExists(session.csrfToken, 'CSRF token');
      assert(session.csrfToken.length > 0, 'CSRF token is non-empty');
      cookie = session.cookie;
      csrfToken = session.csrfToken;
    });

    await test('unauthenticated request to write endpoint is rejected', async () => {
      const res = await fetch(`${BASE_URL}/jsonapi/node/student_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
        body: JSON.stringify({ data: { type: 'node--student_profile', attributes: { title: 'test' } } }),
      });
      // Drupal returns 403 or 422 for unauthenticated writes depending on config
      assert(res.status === 401 || res.status === 403 || res.status === 422,
        `Expected 401/403/422, got ${res.status}`);
    });
  });

  // ------------------------------------------------------------------
  await describe('1. Student Profile CRUD', async () => {
    await test('CREATE student_profile returns 201', async () => {
      const { status, body } = await jsonApiPost(
        '/jsonapi/node/student_profile',
        {
          data: {
            type: 'node--student_profile',
            attributes: {
              title: 'Test Student',
              field_first_name: 'Jane',
              field_last_name: 'Doe',
              field_date_of_birth: '2010-04-16',
              field_grade_applying_for: '5',
            },
          },
        },
        cookie, csrfToken,
      );

      assertEqual(status, 201, 'status');
      assertExists(body.data, 'response body data');
      assertExists(body.data.id, 'resource UUID');
      assertEqual(body.data.type, 'node--student_profile', 'resource type');
      assertEqual(body.data.attributes.field_first_name, 'Jane', 'first name');
      assertEqual(body.data.attributes.field_last_name, 'Doe', 'last name');

      studentProfileId = body.data.id;
    });

    await test('READ student_profile by UUID returns 200', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status, body } = await jsonApiGet(
        `/jsonapi/node/student_profile/${studentProfileId}`,
        cookie,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.id, studentProfileId, 'UUID matches');
      assertEqual(body.data.attributes.field_first_name, 'Jane', 'first name');
    });

    await test('LIST student_profiles returns 200 and includes created record', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status, body } = await jsonApiGet('/jsonapi/node/student_profile', cookie);
      assertEqual(status, 200, 'status');
      assert(Array.isArray(body.data), 'data is array');
      const found = body.data.some((n) => n.id === studentProfileId);
      assert(found, 'created student_profile appears in listing');
    });

    await test('UPDATE student_profile first name returns 200', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status, body } = await jsonApiPatch(
        `/jsonapi/node/student_profile/${studentProfileId}`,
        {
          data: {
            type: 'node--student_profile',
            id: studentProfileId,
            attributes: { field_first_name: 'Janet' },
          },
        },
        cookie, csrfToken,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.attributes.field_first_name, 'Janet', 'updated first name');
    });
  });

  // ------------------------------------------------------------------
  await describe('2. Application CRUD', async () => {
    await test('CREATE application with student_profile reference returns 201', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status, body } = await jsonApiPost(
        '/jsonapi/node/application',
        {
          data: {
            type: 'node--application',
            attributes: {
              title: 'Test Application',
              field_status: 'pending',
            },
            relationships: {
              field_student_profile: {
                data: { type: 'node--student_profile', id: studentProfileId },
              },
            },
          },
        },
        cookie, csrfToken,
      );

      assertEqual(status, 201, 'status');
      assertExists(body.data.id, 'resource UUID');
      assertEqual(body.data.type, 'node--application', 'resource type');
      assertEqual(body.data.attributes.field_status, 'pending', 'default status');
      assertExists(
        body.data.relationships.field_student_profile.data,
        'student_profile relationship set',
      );

      applicationId = body.data.id;
    });

    await test('READ application by UUID returns 200', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status, body } = await jsonApiGet(
        `/jsonapi/node/application/${applicationId}`,
        cookie,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.id, applicationId, 'UUID matches');
    });

    await test('LIST applications returns 200 and includes created record', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status, body } = await jsonApiGet('/jsonapi/node/application', cookie);
      assertEqual(status, 200, 'status');
      assert(Array.isArray(body.data), 'data is array');
      const found = body.data.some((n) => n.id === applicationId);
      assert(found, 'created application appears in listing');
    });

    await test('UPDATE application status to submitted returns 200', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status, body } = await jsonApiPatch(
        `/jsonapi/node/application/${applicationId}`,
        {
          data: {
            type: 'node--application',
            id: applicationId,
            attributes: { field_status: 'submitted' },
          },
        },
        cookie, csrfToken,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.attributes.field_status, 'submitted', 'updated status');
    });

    await test('UPDATE application status to accepted returns 200', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status, body } = await jsonApiPatch(
        `/jsonapi/node/application/${applicationId}`,
        {
          data: {
            type: 'node--application',
            id: applicationId,
            attributes: { field_status: 'accepted' },
          },
        },
        cookie, csrfToken,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.attributes.field_status, 'accepted', 'updated status');
    });

    await test('PATCH with invalid status value returns 422', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status } = await jsonApiPatch(
        `/jsonapi/node/application/${applicationId}`,
        {
          data: {
            type: 'node--application',
            id: applicationId,
            attributes: { field_status: 'not_a_valid_status' },
          },
        },
        cookie, csrfToken,
      );
      assertEqual(status, 422, 'status');
    });
  });

  // ------------------------------------------------------------------
  await describe('3. Document CRUD', async () => {
    await test('UPLOAD file to document field_file endpoint returns 201', async () => {
      // Minimal valid PDF bytes (enough for Drupal to accept as a file upload)
      const fakePdfContent = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj ' +
        '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj ' +
        '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>endobj\n' +
        'xref\n0 4\ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n0\n%%EOF',
      );

      const { status, body } = await jsonApiFileUpload(
        '/jsonapi/node/document/field_file',
        'test-transcript.pdf',
        fakePdfContent,
        cookie, csrfToken,
      );

      assertEqual(status, 201, 'status');
      assertExists(body.data, 'response body data');
      assertExists(body.data.id, 'file entity UUID');
      assertEqual(body.data.type, 'file--file', 'resource type');

      uploadedFileId = body.data.id;
    });

    await test('CREATE document node with application and file reference returns 201', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      assertExists(uploadedFileId, 'prerequisite: uploadedFileId');
      const { status, body } = await jsonApiPost(
        '/jsonapi/node/document',
        {
          data: {
            type: 'node--document',
            attributes: {
              title: 'Test Document',
              field_document_type: 'transcript',
            },
            relationships: {
              field_application: {
                data: { type: 'node--application', id: applicationId },
              },
              field_file: {
                data: { type: 'file--file', id: uploadedFileId },
              },
            },
          },
        },
        cookie, csrfToken,
      );

      assertEqual(status, 201, 'status');
      assertExists(body.data.id, 'resource UUID');
      assertEqual(body.data.attributes.field_document_type, 'transcript', 'document type');
      assertExists(
        body.data.relationships.field_application.data,
        'application relationship set',
      );

      documentId = body.data.id;
    });

    await test('READ document by UUID returns 200', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status, body } = await jsonApiGet(
        `/jsonapi/node/document/${documentId}`,
        cookie,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.id, documentId, 'UUID matches');
    });

    await test('LIST documents returns 200 and includes created record', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status, body } = await jsonApiGet('/jsonapi/node/document', cookie);
      assertEqual(status, 200, 'status');
      assert(Array.isArray(body.data), 'data is array');
      const found = body.data.some((n) => n.id === documentId);
      assert(found, 'created document appears in listing');
    });

    await test('UPDATE document type to id returns 200', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status, body } = await jsonApiPatch(
        `/jsonapi/node/document/${documentId}`,
        {
          data: {
            type: 'node--document',
            id: documentId,
            attributes: { field_document_type: 'id' },
          },
        },
        cookie, csrfToken,
      );
      assertEqual(status, 200, 'status');
      assertEqual(body.data.attributes.field_document_type, 'id', 'updated document type');
    });
  });

  // ------------------------------------------------------------------
  await describe('4. Relationship integrity', async () => {
    await test('GET application with student_profile include returns embedded data', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status, body } = await jsonApiGet(
        `/jsonapi/node/application/${applicationId}?include=field_student_profile`,
        cookie,
      );
      assertEqual(status, 200, 'status');
      assertExists(body.included, 'included array present');
      const profile = body.included.find((r) => r.type === 'node--student_profile');
      assertExists(profile, 'student_profile in included');
      assertEqual(profile.id, studentProfileId, 'correct student_profile included');
    });

    await test('GET document with application include returns embedded data', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status, body } = await jsonApiGet(
        `/jsonapi/node/document/${documentId}?include=field_application`,
        cookie,
      );
      assertEqual(status, 200, 'status');
      assertExists(body.included, 'included array present');
      const app = body.included.find((r) => r.type === 'node--application');
      assertExists(app, 'application in included');
      assertEqual(app.id, applicationId, 'correct application included');
    });
  });

  // ------------------------------------------------------------------
  await describe('5. Cleanup (DELETE)', async () => {
    await test('DELETE document returns 204', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status } = await jsonApiDelete(
        `/jsonapi/node/document/${documentId}`,
        cookie, csrfToken,
      );
      assertEqual(status, 204, 'status');
    });

    await test('GET deleted document returns 404', async () => {
      assertExists(documentId, 'prerequisite: documentId');
      const { status } = await jsonApiGet(
        `/jsonapi/node/document/${documentId}`,
        cookie,
      );
      assertEqual(status, 404, 'status');
    });

    await test('DELETE application returns 204', async () => {
      assertExists(applicationId, 'prerequisite: applicationId');
      const { status } = await jsonApiDelete(
        `/jsonapi/node/application/${applicationId}`,
        cookie, csrfToken,
      );
      assertEqual(status, 204, 'status');
    });

    await test('DELETE student_profile returns 204', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status } = await jsonApiDelete(
        `/jsonapi/node/student_profile/${studentProfileId}`,
        cookie, csrfToken,
      );
      assertEqual(status, 204, 'status');
    });

    await test('GET deleted student_profile returns 404', async () => {
      assertExists(studentProfileId, 'prerequisite: studentProfileId');
      const { status } = await jsonApiGet(
        `/jsonapi/node/student_profile/${studentProfileId}`,
        cookie,
      );
      assertEqual(status, 404, 'status');
    });
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed}/${total} passed`);
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(({ name, error }) => {
      console.log(`  ✗ ${name}`);
      console.log(`    ${error}`);
    });
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('\nUnexpected error during test run:', err);
  process.exit(1);
});
