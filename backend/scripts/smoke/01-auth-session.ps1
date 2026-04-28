# backend/scripts/smoke/01-auth-session.ps1
# Smoke tests: Authentication, session management, and login_status contracts.
#
# Usage (standalone):
#   pwsh ./backend/scripts/smoke/01-auth-session.ps1 `
#       -BaseUrl 'http://localhost:8080' -AdminUser admin -AdminPass password123
#
# When called from run-all.ps1 the parameters are inherited via script scope.

param(
    [string]$BaseUrl   = $null,
    [string]$AdminUser = $null,
    [string]$AdminPass = $null
)

. "$PSScriptRoot/common.ps1"

# Allow run-all.ps1 to inject values via script-scope variables.
if ($BaseUrl)   { $Script:BaseUrl   = $BaseUrl }
if ($AdminUser) { $Script:AdminUser = $AdminUser }
if ($AdminPass) { $Script:AdminPass = $AdminPass }

$Script:BaseUrl   = if ($Script:BaseUrl)   { $Script:BaseUrl }   else { 'http://localhost:8080' }
$Script:AdminUser = if ($Script:AdminUser) { $Script:AdminUser } else { 'admin' }
$Script:AdminPass = if ($Script:AdminPass) { $Script:AdminPass } else { 'password123' }

# ---------------------------------------------------------------------------
# Test 1: Anonymous login_status returns 0
# ---------------------------------------------------------------------------
Write-Step 'Test 1 — Anonymous login_status returns 0'

$resp = Invoke-Api -Method GET -Path '/user/login_status?_format=json'
Assert-StatusCode 200 $resp.StatusCode 'GET /user/login_status (anonymous)'
$status_value = $resp.Content.Trim()
Assert-True ($status_value -eq '0') "login_status is '0' for anonymous (got '$status_value')"

# ---------------------------------------------------------------------------
# Test 2: /session/token returns a non-empty string
# ---------------------------------------------------------------------------
Write-Step 'Test 2 — GET /session/token returns non-empty token'

$resp = Invoke-Api -Method GET -Path '/session/token'
Assert-StatusCode 200 $resp.StatusCode 'GET /session/token'
$token = $resp.Content.Trim()
Assert-True (-not [string]::IsNullOrEmpty($token)) "session/token is non-empty (got '$token')"

# ---------------------------------------------------------------------------
# Test 3: Login with admin credentials succeeds
# ---------------------------------------------------------------------------
Write-Step 'Test 3 — Login with admin credentials returns 200 + tokens'

$auth = Invoke-Login -Username $Script:AdminUser -Password $Script:AdminPass
# Invoke-Login already asserts internally; we just verify the return value.
Assert-True ($null -ne $auth) 'Invoke-Login returned a session hashtable'
Assert-True ($null -ne $auth.Session) 'Login session object is present'

# ---------------------------------------------------------------------------
# Test 4: Authenticated login_status returns 1
# ---------------------------------------------------------------------------
Write-Step 'Test 4 — Authenticated login_status returns 1'

$resp = Invoke-Api -Method GET -Path '/user/login_status?_format=json' -WebSession $auth.Session
Assert-StatusCode 200 $resp.StatusCode 'GET /user/login_status (authenticated)'
$auth_status = $resp.Content.Trim()
Assert-True ($auth_status -eq '1') "login_status is '1' for authenticated user (got '$auth_status')"

# ---------------------------------------------------------------------------
# Test 5: /api/session/info returns user data for authenticated session
# ---------------------------------------------------------------------------
Write-Step 'Test 5 — GET /api/session/info returns user data for authenticated session'

$resp = Invoke-Api -Method GET -Path '/api/session/info?_format=json' -WebSession $auth.Session
Assert-StatusCode 200 $resp.StatusCode 'GET /api/session/info (authenticated)'

$session_info = Get-Json $resp
Assert-True ($null -ne $session_info)                                      'session/info response has JSON body'
Assert-True (-not [string]::IsNullOrEmpty($session_info.logout_token))    'session/info has logout_token'
Assert-True ($null -ne $session_info.current_user)                         'session/info has current_user'
Assert-True ($session_info.current_user.uid -gt 0)                         'session/info current_user.uid is positive'
Assert-True (-not [string]::IsNullOrEmpty($session_info.current_user.name)) 'session/info current_user.name is non-empty'

# ---------------------------------------------------------------------------
# Test 6: /api/session/info returns 403 for anonymous
# ---------------------------------------------------------------------------
Write-Step 'Test 6 — GET /api/session/info returns 403 for anonymous'

$resp = Invoke-Api -Method GET -Path '/api/session/info?_format=json'
Assert-StatusCode 403 $resp.StatusCode 'GET /api/session/info (anonymous) returns 403'

Write-Host "`n[01-auth-session] All tests passed." -ForegroundColor Green
