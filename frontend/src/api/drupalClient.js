const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL;

if (!BASE_URL) {
  console.error('REACT_APP_DRUPAL_BASE_URL is not set. API calls will fail.');
}

/**
 * Fetches a fresh CSRF token from Drupal's session/token endpoint.
 * Do not cache long-term; fetch fresh before mutating calls.
 * @returns {Promise<string>}
 */
async function fetchCsrfToken() {
  const response = await fetch(`${BASE_URL}/session/token`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  return response.text();
}

/**
 * Parses Drupal JSON:API error responses and builds a structured Error.
 * @param {Response} response
 * @returns {Promise<Error>}
 */
async function buildError(response) {
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    if (body.errors && body.errors.length > 0) {
      message = body.errors.map((e) => e.detail || e.title).join('; ');
    } else if (body.message) {
      message = body.message;
    }
  } catch (_) {
    // Response body is not JSON; use default message
  }
  const err = new Error(message);
  err.status = response.status;
  return err;
}

/**
 * GET request — includes session cookie.
 * @param {string} path  Path relative to DRUPAL_BASE_URL
 * @returns {Promise<any>}
 */
export async function get(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json, application/vnd.api+json',
    },
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return response.json();
}

/**
 * POST request — fetches CSRF token first, then sends JSON body.
 * @param {string} path
 * @param {object} body
 * @param {string} [contentType]  Override Content-Type (default: application/vnd.api+json)
 * @returns {Promise<any>}
 */
export async function post(path, body, contentType = 'application/vnd.api+json') {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': contentType,
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  // Some POST endpoints (e.g. /user/login) may return non-JSON
  const responseContentType = response.headers.get('Content-Type') || '';
  if (responseContentType.includes('json')) {
    return response.json();
  }
  return null;
}

/**
 * PATCH request — fetches CSRF token first, then sends JSON body.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<any>}
 */
export async function patch(path, body) {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return response.json();
}

/**
 * File upload — fetches CSRF token, then POSTs as multipart/form-data.
 * The frontend treats the file as opaque binary; all content validation
 * is done server-side by Drupal.
 * @param {string} path
 * @param {File} file
 * @returns {Promise<any>}
 */
export async function uploadFile(path, file) {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `file; filename="${file.name}"`,
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: file,
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return response.json();
}
