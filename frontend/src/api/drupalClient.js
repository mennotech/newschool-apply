const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || '';

let _baseUrl = BASE_URL;

export function setBaseUrl(url) {
  _baseUrl = url;
}

function getBaseUrl() {
  return _baseUrl || process.env.REACT_APP_DRUPAL_BASE_URL || '';
}

export async function getCsrfToken() {
  const res = await fetch(`${getBaseUrl()}/session/token`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  return res.text();
}

function parseError(res, body) {
  if (body && body.errors && body.errors.length > 0) {
    return body.errors.map((e) => e.detail || e.title || 'Unknown error').join(' ');
  }
  if (body && body.message) return body.message;
  return `Request failed with status ${res.status}`;
}

async function handleResponse(res) {
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg = parseError(res, body);
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function get(path) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/vnd.api+json' },
  });
  return handleResponse(res);
}

export async function post(path, body) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function patch(path, body) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function delete_(path) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
  });
  if (res.status === 204) return null;
  return handleResponse(res);
}

export async function uploadFile(path, file) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
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
  return handleResponse(res);
}

export async function login(name, pass) {
  const res = await fetch(`${getBaseUrl()}/user/login?_format=json`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, pass }),
  });
  return handleResponse(res);
}

export async function logout(logoutToken) {
  const res = await fetch(
    `${getBaseUrl()}/user/logout?_format=json&token=${encodeURIComponent(logoutToken)}`,
    { credentials: 'include' }
  );
  return handleResponse(res);
}

export async function getLoginStatus() {
  const res = await fetch(`${getBaseUrl()}/user/login_status?_format=json`, {
    credentials: 'include',
  });
  if (!res.ok) return false;
  const text = await res.text();
  return text.trim() === '1';
}

export async function getLogoutToken() {
  const res = await fetch(`${getBaseUrl()}/api/session/info?_format=json`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch session info');
  }
  const data = await res.json();
  return data.logout_token;
}
