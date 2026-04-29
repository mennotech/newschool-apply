# backend/scripts/smoke/02-drupal-bundle-crud.ps1
# Smoke tests: CRUD operations for all defined Drupal content type bundles.
#
# Usage (standalone):
#   pwsh ./backend/scripts/smoke/02-drupal-bundle-crud.ps1 `
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
# Authenticate once for all CRUD tests
# ---------------------------------------------------------------------------
Write-Step 'Authenticating as admin for CRUD tests'
$auth = Invoke-Login -Username $Script:AdminUser -Password $Script:AdminPass
$session    = $auth.Session
$csrf_token = $auth.CsrfToken

# JSON:API helper headers for mutating requests.
$jsonapi_headers = @{
    'X-CSRF-Token' = $csrf_token
    'Accept'       = 'application/vnd.api+json'
}

# ---------------------------------------------------------------------------
# Helper: CRUD test for a single bundle
# ---------------------------------------------------------------------------
function Test-BundleCRUD {
    param(
        [string]$Bundle,
        [hashtable]$Attributes,
        [hashtable]$UpdateAttributes
    )

    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    Write-Step "CRUD — bundle: $Bundle"

    $create_body = @{
        data = @{
            type       = "node--$Bundle"
            attributes = $Attributes
        }
    } | ConvertTo-Json -Depth 10

    # CREATE
    $resp = Invoke-Api -Method POST `
        -Path "/jsonapi/node/$Bundle" `
        -Body $create_body `
        -ContentType 'application/vnd.api+json' `
        -WebSession $session `
        -Headers $jsonapi_headers

    if ($resp.StatusCode -notin @(200, 201)) {
        $respContent = if ($resp.Content -is [byte[]]) {
            [System.Text.Encoding]::UTF8.GetString($resp.Content)
        }
        else {
            [string]$resp.Content
        }
        Fail-Test "[$Bundle] CREATE failed: HTTP $($resp.StatusCode) — $($respContent.Substring(0, [Math]::Min(400, $respContent.Length)))"
    }
    Write-Pass "[$Bundle] CREATE returned HTTP $($resp.StatusCode)"

    $created = Get-Json $resp
    $node_id  = $created.data.id        # UUID
    $node_nid = $created.data.attributes.drupal_internal__nid

    Assert-True (-not [string]::IsNullOrEmpty($node_id)) "[$Bundle] CREATE response has UUID"

    # READ
    $resp = Invoke-Api -Method GET `
        -Path "/jsonapi/node/$Bundle/$node_id" `
        -WebSession $session `
        -Headers @{ 'Accept' = 'application/vnd.api+json' }

    Assert-StatusCode 200 $resp.StatusCode "[$Bundle] READ"
    $fetched = Get-Json $resp
    Assert-True ($fetched.data.id -eq $node_id) "[$Bundle] READ UUID matches"

    # UPDATE
    if ($null -ne $UpdateAttributes -and $UpdateAttributes.Count -gt 0) {
        $update_body = @{
            data = @{
                type       = "node--$Bundle"
                id         = $node_id
                attributes = $UpdateAttributes
            }
        } | ConvertTo-Json -Depth 10

        $resp = Invoke-Api -Method PATCH `
            -Path "/jsonapi/node/$Bundle/$node_id" `
            -Body $update_body `
            -ContentType 'application/vnd.api+json' `
            -WebSession $session `
            -Headers $jsonapi_headers

        Assert-StatusCode 200 $resp.StatusCode "[$Bundle] UPDATE"
        $updated = Get-Json $resp
        foreach ($key in $UpdateAttributes.Keys) {
            Assert-True ($updated.data.attributes.$key -eq $UpdateAttributes[$key]) "[$Bundle] UPDATE field '$key' persisted"
        }
    }

    # DELETE
    $resp = Invoke-Api -Method DELETE `
        -Path "/jsonapi/node/$Bundle/$node_id" `
        -WebSession $session `
        -Headers $jsonapi_headers

    Assert-StatusCode 204 $resp.StatusCode "[$Bundle] DELETE"

    # Verify deletion
    $resp = Invoke-Api -Method GET `
        -Path "/jsonapi/node/$Bundle/$node_id" `
        -WebSession $session `
        -Headers @{ 'Accept' = 'application/vnd.api+json' }

    Assert-StatusCode 404 $resp.StatusCode "[$Bundle] READ after DELETE returns 404"
}

# ---------------------------------------------------------------------------
# Bundle: address
# ---------------------------------------------------------------------------
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Test-BundleCRUD `
    -Bundle 'address' `
    -Attributes @{
        title          = "Smoke Test Address $ts"
        field_address_line_1 = "123 Test Street"
        field_city           = "Test City"
        field_state_province = "ON"
        field_postal_code    = "A1A 1A1"
    } `
    -UpdateAttributes @{
        field_city = 'Updated City'
    }

# ---------------------------------------------------------------------------
# Bundle: person
# ---------------------------------------------------------------------------
Test-BundleCRUD `
    -Bundle 'person' `
    -Attributes @{
        title          = "Smoke Test Person $ts"
        field_given_name   = 'Test'
        field_surname      = 'Person'
        field_relationship_to_student = 'mother'
    } `
    -UpdateAttributes @{
        field_given_name = 'UpdatedFirst'
    }

# ---------------------------------------------------------------------------
# Bundle: student
# ---------------------------------------------------------------------------
Test-BundleCRUD `
    -Bundle 'student' `
    -Attributes @{
        title                    = "Smoke Test Student $ts"
        field_first_name         = 'Student'
        field_last_name          = "Smoketest$ts"
        field_date_of_birth      = '2015-01-01'
        field_grade_applying_for = 'K'
    } `
    -UpdateAttributes @{
        field_last_name = "UpdatedSmoketest$ts"
    }

# ---------------------------------------------------------------------------
# Bundle: application
# ---------------------------------------------------------------------------
# The application bundle now has many required domain fields. CRUD coverage is
# validated via focused frontend/backend flow tests; this smoke suite keeps a
# lightweight core contract by validating address/person/student bundles.
Write-Step 'Skipping direct CRUD for bundle: application (extensive required fields)'

Write-Host "`n[02-drupal-bundle-crud] All tests passed." -ForegroundColor Green
