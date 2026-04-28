const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || '';

export function setBaseUrl(url) {
  // Base URL is read from environment; this exists as a helper for testing
  process.env.REACT_APP_DRUPAL_BASE_URL = url;
}

function getBaseUrl() {
  return process.env.REACT_APP_DRUPAL_BASE_URL || '';
}

function parseDrupalError(data) {
  if (data && data.errors && Array.isArray(data.errors)) {
    return data.errors.map((e) => e.detail || e.title || 'Unknown error').join('; ');
  }
  if (data && data.message) {
    return data.message;
  }
  return 'An unknown error occurred';
}

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') ||
    contentType.includes('application/vnd.api+json');

  let data;
  if (isJson) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message = isJson && data ? parseDrupalError(data) : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function getCsrfToken() {
  const response = await fetch(`${getBaseUrl()}/session/token`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  return response.text();
}

export async function get(path) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/vnd.api+json',
    },
  });
  return handleResponse(response);
}

export async function post(path, body) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function patch(path, body) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function delete_(path) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/vnd.api+json',
      'X-CSRF-Token': csrfToken,
    },
  });
  if (response.status === 204) return null;
  return handleResponse(response);
}

export async function uploadFile(path, file) {
  const csrfToken = await getCsrfToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Disposition': `file; filename="${file.name}"`,
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });
  return handleResponse(response);
}

export async function login(name, pass) {
  const response = await fetch(`${getBaseUrl()}/user/login?_format=json`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ name, pass }),
  });
  return handleResponse(response);
}

export async function logout(logoutToken) {
  const response = await fetch(
    `${getBaseUrl()}/user/logout?_format=json&token=${encodeURIComponent(logoutToken)}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    }
  );
  if (response.ok || response.status === 204 || response.status === 200) {
    return true;
  }
  const error = new Error(`Logout failed with status ${response.status}`);
  error.status = response.status;
  throw error;
}

export async function getLoginStatus() {
  const response = await fetch(`${getBaseUrl()}/user/login_status?_format=json`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => 0);
  return data === 1;
}

export async function getLogoutToken() {
  const response = await fetch(`${getBaseUrl()}/api/session/info?_format=json`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse(response);
}
