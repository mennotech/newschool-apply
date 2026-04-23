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
 * Returns true when Drupal reports an authenticated session, false otherwise.
 * Uses the core login_status route which is safe for anonymous access.
 * @returns {Promise<boolean>}
 */
export async function getLoginStatus() {
  const response = await fetch(`${BASE_URL}/user/login_status?_format=json`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json, text/plain',
    },
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  const body = (await response.text()).trim();
  return body === '1' || body === 'true';
}

/**
 * Recovers Drupal's logout token from an authenticated HTML page.
 * This is needed when the user authenticated outside the frontend flow
 * (e.g. directly in Drupal) and no logout token is stored client-side.
 * @returns {Promise<string>}
 */
export async function getLogoutToken() {
  const response = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  const html = await response.text();
  const tokenMatch = html.match(/\/user\/logout\?token=([^"'&<>\s]+)/i);
  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error('Failed to resolve logout token from active Drupal session');
  }

  return decodeURIComponent(tokenMatch[1]);
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
 * Logout request — prefers Drupal's tokenized logout route to invalidate
 * the session cookie, then falls back to CSRF-protected POST.
 * @param {string|null} [logoutToken]
 * @returns {Promise<void>}
 */
export async function logout(logoutToken = null) {
  const tokenQuery = logoutToken ? `&token=${encodeURIComponent(logoutToken)}` : '';
  const getResponse = await fetch(`${BASE_URL}/user/logout?_format=json${tokenQuery}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (getResponse.ok) {
    return;
  }

  const csrfToken = await fetchCsrfToken();
  const postResponse = await fetch(`${BASE_URL}/user/logout?_format=json${tokenQuery}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({}),
  });

  if (!postResponse.ok) {
    throw await buildError(postResponse);
  }
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
 * DELETE request — fetches CSRF token first, then sends delete.
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function del(path) {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
  });
  if (!response.ok) {
    throw await buildError(response);
  }
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
