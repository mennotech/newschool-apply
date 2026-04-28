# backend/scripts/smoke/run-all.ps1
# Single entry-point runner for all NewSchool Apply backend smoke tests.
#
# Usage:
#   pwsh ./backend/scripts/smoke/run-all.ps1
#   pwsh ./backend/scripts/smoke/run-all.ps1 -BaseUrl 'http://localhost:8080' -AdminUser admin -AdminPass password123

param(
    [string]$BaseUrl   = 'http://localhost:8080',
    [string]$AdminUser = 'admin',
    [string]$AdminPass = 'password123'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Inject connection details into script scope so common.ps1 and test scripts
# can read them without requiring every script to re-declare the same params.
$Script:BaseUrl   = $BaseUrl
$Script:AdminUser = $AdminUser
$Script:AdminPass = $AdminPass

# Dot-source shared helpers.
. "$PSScriptRoot/common.ps1"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host " NewSchool Apply — Backend Smoke Tests  " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " BaseUrl  : $BaseUrl"
Write-Host " AdminUser: $AdminUser"
Write-Host ""

$test_scripts = @(
    "$PSScriptRoot/01-auth-session.ps1"
    "$PSScriptRoot/02-drupal-bundle-crud.ps1"
    "$PSScriptRoot/03-payments-and-logout.ps1"
)

$failed = $false

foreach ($script in $test_scripts) {
    $name = Split-Path $script -Leaf
    Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
    Write-Host " Running: $name" -ForegroundColor White
    Write-Host "----------------------------------------" -ForegroundColor DarkGray

    try {
        & $script -BaseUrl $BaseUrl -AdminUser $AdminUser -AdminPass $AdminPass
        $exitCodeVar = Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue
        $exitCode = if ($null -ne $exitCodeVar) { [int]$exitCodeVar.Value } else { 0 }
        if ($exitCode -ne 0) {
            Write-Host "`n[FAILED] $name exited with code $exitCode" -ForegroundColor Red
            $failed = $true
            break
        }
    }
    catch {
        Write-Host "`n[FAILED] $name threw an exception: $_" -ForegroundColor Red
        $failed = $true
        break
    }
}

Write-Host "`n========================================"
if ($failed) {
    Write-Host " SMOKE TESTS FAILED" -ForegroundColor Red
    Write-Host "========================================"
    exit 1
}
else {
    Write-Host " ALL SMOKE TESTS PASSED" -ForegroundColor Green
    Write-Host "========================================"
    exit 0
}
