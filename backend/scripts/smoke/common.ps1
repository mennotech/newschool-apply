# backend/scripts/smoke/common.ps1
# Shared helper functions for NewSchool Apply backend smoke tests.
# Dot-source this file from every test script:  . "$PSScriptRoot/common.ps1"
#
# Requirements: PowerShell 7+ (pwsh), cross-platform.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "    [PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "    [FAIL] $Message" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# Test assertion helpers
# ---------------------------------------------------------------------------

function Fail-Test {
    param([string]$Reason)
    Write-Fail $Reason
    exit 1
}

function Assert-StatusCode {
    param(
        [int]$Expected,
        [int]$Actual,
        [string]$Context = ''
    )
    if ($Actual -ne $Expected) {
        $label = if ($Context) { " ($Context)" } else { '' }
        Fail-Test "Expected HTTP $Expected but got $Actual$label"
    }
    $label = if ($Context) { " — $Context" } else { '' }
    Write-Pass "HTTP $Actual$label"
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        Fail-Test $Message
    }
    Write-Pass $Message
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

# $Script:BaseUrl is set by run-all.ps1 before dot-sourcing this file.
# Individual scripts can also override it.
if (-not (Get-Variable -Name BaseUrl -Scope Script -ErrorAction SilentlyContinue)) {
    $Script:BaseUrl = 'http://localhost:8080'
}

function Invoke-Api {
    <#
    .SYNOPSIS
        Wrapper around Invoke-WebRequest that always returns a response object.
        Does NOT throw on non-2xx status codes.
    .PARAMETER Method
        HTTP method (GET, POST, PATCH, DELETE).
    .PARAMETER Path
        URL path relative to $Script:BaseUrl, e.g. '/user/login_status?_format=json'.
    .PARAMETER Body
        Hashtable or string body for POST/PATCH requests.
    .PARAMETER ContentType
        Content-Type header value. Defaults to 'application/json'.
    .PARAMETER WebSession
        Optional WebRequestSession for cookie reuse.
    .PARAMETER Headers
        Optional hashtable of extra headers.
    #>
    param(
        [string]$Method = 'GET',
        [string]$Path,
        [object]$Body = $null,
        [string]$ContentType = 'application/json',
        [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession = $null,
        [hashtable]$Headers = @{}
    )

    $uri = "$($Script:BaseUrl)$Path"

    $params = @{
        Method             = $Method
        Uri                = $uri
        UseBasicParsing    = $true
        SkipHttpErrorCheck = $true   # pwsh 7+ — never throws on 4xx/5xx
        ErrorAction        = 'Stop'
    }

    if ($WebSession) {
        $params['WebSession'] = $WebSession
    }
    else {
        $params['SessionVariable'] = '_unused'
    }

    if ($Headers.Count -gt 0) {
        $params['Headers'] = $Headers
    }

    if ($null -ne $Body) {
        if ($Body -is [string]) {
            $params['Body'] = $Body
        }
        else {
            $params['Body'] = $Body | ConvertTo-Json -Depth 10
        }
        $params['ContentType'] = $ContentType
    }

    return Invoke-WebRequest @params
}

function Get-Json {
    <#
    .SYNOPSIS
        Parses the JSON body of an Invoke-WebRequest response.
    #>
    param(
        [object]$Response
    )
    $content = if ($Response.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($Response.Content)
    }
    else {
        [string]$Response.Content
    }

    if ([string]::IsNullOrWhiteSpace($content)) {
        return $null
    }
    try {
        return $content | ConvertFrom-Json
    }
    catch {
        Fail-Test "Failed to parse JSON response: $($content.Substring(0, [Math]::Min(200, $content.Length)))"
    }
}

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

function New-WebSession {
    <#
    .SYNOPSIS
        Creates a new empty WebRequestSession (cookie jar).
    #>
    return [Microsoft.PowerShell.Commands.WebRequestSession]::new()
}

function Invoke-Login {
    <#
    .SYNOPSIS
        Logs in with username/password and returns a session hashtable:
          @{ Session = <WebRequestSession>; CsrfToken = '...'; LogoutToken = '...' }
    #>
    param(
        [string]$Username,
        [string]$Password
    )

    $session = New-WebSession

    $resp = Invoke-Api -Method POST -Path '/user/login?_format=json' `
        -Body @{ name = $Username; pass = $Password } `
        -WebSession $session

    Assert-StatusCode 200 $resp.StatusCode 'Login'

    $json = Get-Json $resp
    Assert-True ($null -ne $json) 'Login response has JSON body'

    $csrf_token   = $json.csrf_token
    $logout_token = $json.logout_token

    Assert-True (-not [string]::IsNullOrEmpty($csrf_token))   'Login response has csrf_token'
    Assert-True (-not [string]::IsNullOrEmpty($logout_token)) 'Login response has logout_token'

    return @{
        Session      = $session
        CsrfToken    = $csrf_token
        LogoutToken  = $logout_token
    }
}
