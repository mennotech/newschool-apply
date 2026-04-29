# backend/scripts/smoke/03-payments-and-logout.ps1
# Smoke tests: Payment endpoint contracts and session logout.
#
# Usage (standalone):
#   pwsh ./backend/scripts/smoke/03-payments-and-logout.ps1 `
#       -BaseUrl 'http://localhost:8080' -AdminUser admin -AdminPass password123

param(
    [string]$BaseUrl   = $null,
    [string]$AdminUser = $null,
    [string]$AdminPass = $null
)

. "$PSScriptRoot/common.ps1"

if ($BaseUrl)   { $Script:BaseUrl   = $BaseUrl }
if ($AdminUser) { $Script:AdminUser = $AdminUser }
if ($AdminPass) { $Script:AdminPass = $AdminPass }

$Script:BaseUrl   = if ($Script:BaseUrl)   { $Script:BaseUrl }   else { 'http://localhost:8080' }
$Script:AdminUser = if ($Script:AdminUser) { $Script:AdminUser } else { 'admin' }
$Script:AdminPass = if ($Script:AdminPass) { $Script:AdminPass } else { 'password123' }

# ---------------------------------------------------------------------------
# Authenticate
# ---------------------------------------------------------------------------
Write-Step 'Authenticating as admin for payment contract tests'
$auth    = Invoke-Login -Username $Script:AdminUser -Password $Script:AdminPass
$session = $auth.Session
$csrf    = $auth.CsrfToken

# ---------------------------------------------------------------------------
# Test 1: Checkout endpoint rejects missing application_id (400)
# ---------------------------------------------------------------------------
Write-Step 'Test 1 — Checkout endpoint rejects request with no application_id'

$resp = Invoke-Api -Method POST `
    -Path '/api/payments/checkout-session' `
    -Body @{} `
    -WebSession $session `
    -Headers @{ 'X-CSRF-Token' = $csrf }

Assert-True ($resp.StatusCode -in @(400, 422)) "Checkout with no application_id returns 4xx (got $($resp.StatusCode))"
Write-Pass "Checkout with no application_id returns $($resp.StatusCode)"

# ---------------------------------------------------------------------------
# Test 2: Checkout endpoint rejects non-existent application
# ---------------------------------------------------------------------------
Write-Step 'Test 2 — Checkout endpoint returns 404 for unknown application'

$resp = Invoke-Api -Method POST `
    -Path '/api/payments/checkout-session' `
    -Body @{ application_id = 99999999 } `
    -WebSession $session `
    -Headers @{ 'X-CSRF-Token' = $csrf }

Assert-True ($resp.StatusCode -in @(404, 422)) "Checkout with unknown application_id returns 4xx (got $($resp.StatusCode))"
Write-Pass "Checkout with unknown application_id returns $($resp.StatusCode)"

# ---------------------------------------------------------------------------
# Test 3: Checkout endpoint requires authentication (anonymous → 403)
# ---------------------------------------------------------------------------
Write-Step 'Test 3 — Checkout endpoint returns 403 for anonymous'

$resp = Invoke-Api -Method POST `
    -Path '/api/payments/checkout-session' `
    -Body @{ application_id = 1 }

Assert-StatusCode 403 $resp.StatusCode 'Anonymous checkout returns 403'

# ---------------------------------------------------------------------------
# Test 4: Checkout-status endpoint requires authentication (anonymous → 403)
# ---------------------------------------------------------------------------
Write-Step 'Test 4 — Checkout-status endpoint returns 403 for anonymous'

$resp = Invoke-Api -Method GET -Path '/api/payments/checkout-status?session_id=cs_test_fake'
Assert-StatusCode 403 $resp.StatusCode 'Anonymous checkout-status returns 403'

# ---------------------------------------------------------------------------
# Test 5: Webhook endpoint rejects requests with invalid/missing signature
# ---------------------------------------------------------------------------
Write-Step 'Test 5 — Stripe webhook rejects missing Stripe-Signature'

$fake_event = @{
    id   = 'evt_test_fake'
    type = 'checkout.session.completed'
    data = @{ object = @{ id = 'cs_test_fake' } }
} | ConvertTo-Json -Depth 10

$resp = Invoke-Api -Method POST `
    -Path '/api/payments/stripe/webhook' `
    -Body $fake_event `
    -ContentType 'application/json'

# Should be 400 (bad signature or not configured).
Assert-True ($resp.StatusCode -in @(400, 403)) "Webhook without signature returns 4xx (got $($resp.StatusCode))"
Write-Pass "Webhook without Stripe-Signature returns $($resp.StatusCode)"

# ---------------------------------------------------------------------------
# Test 6: Logout invalidates session
# ---------------------------------------------------------------------------
Write-Step 'Test 6 — Logout invalidates the session'

$logout_token = $auth.LogoutToken
$resp = Invoke-Api -Method GET `
    -Path "/user/logout?_format=json&token=$logout_token" `
    -WebSession $session

Assert-True ($resp.StatusCode -in @(200, 204)) "Logout returns 2xx (got $($resp.StatusCode))"
Write-Pass "Logout returned $($resp.StatusCode)"

# ---------------------------------------------------------------------------
# Test 7: Post-logout login_status returns 0
# ---------------------------------------------------------------------------
Write-Step 'Test 7 — Post-logout login_status returns 0'

$resp = Invoke-Api -Method GET -Path '/user/login_status?_format=json' -WebSession $session
Assert-StatusCode 200 $resp.StatusCode 'GET /user/login_status post-logout'
$status_after = $resp.Content.Trim()
Assert-True ($status_after -eq '0') "login_status is '0' after logout (got '$status_after')"

Write-Host "`n[03-payments-and-logout] All tests passed." -ForegroundColor Green
