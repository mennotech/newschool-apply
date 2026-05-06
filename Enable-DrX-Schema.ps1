Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$schemaRoot = (Resolve-Path (Join-Path $PSScriptRoot 'schema')).Path
$moduleName = 'DrX-Schema'
$modulePathEntries = @($env:PSModulePath -split [System.IO.Path]::PathSeparator | Where-Object { $_ })

if ($modulePathEntries -notcontains $schemaRoot) {
  $env:PSModulePath = '{0}{1}{2}' -f $schemaRoot, [System.IO.Path]::PathSeparator, $env:PSModulePath
}

Import-Module $moduleName -Force -Global

Write-Host ('Loaded {0} from {1}' -f $moduleName, (Join-Path $schemaRoot $moduleName))
Write-Host 'Defaults:'
Write-Host '  .env loads from the current directory first, then the repo root.'
Write-Host '  Schema loads from DRX_SCHEMA_PATH when set, otherwise schema/v2.'
Write-Host 'Examples:'
Write-Host '  Invoke-DrXApiSmokeTest'
Write-Host '  Invoke-DrXDbSchemaValidation'
Write-Host '  Invoke-DrXInternalApiSchemaValidation'
Write-Host '  Invoke-DrXExternalApiSchemaValidation'
Write-Host '  Export-DrXDrupalScaffoldConfig'
Write-Host 'Overrides:'
Write-Host '  $env:DRX_SCHEMA_PATH = ''schema/v2'''
Write-Host '  Invoke-DrXDbSchemaValidation -SchemaPath schema/custom'