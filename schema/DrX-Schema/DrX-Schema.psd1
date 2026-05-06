@{
  RootModule = 'DrX-Schema.psm1'
  ModuleVersion = '0.1.0'
  GUID = 'be8dc9f9-3680-42bb-a157-01480e7365b1'
  Author = 'GitHub Copilot'
  CompanyName = 'Mennotech'
  Copyright = '(c) Mennotech'
  Description = 'Backend schema scaffolding and validation helpers for NewSchool Apply.'
  PowerShellVersion = '5.1'
  FunctionsToExport = @(
    'Connect-DrXBackend',
    'ConvertTo-DrXNormalizedSchema',
    'Export-DrXDrupalScaffoldConfig',
    'Get-DrXBackendCandidates',
    'Get-DrXEnvMap',
    'Get-DrXFieldMapping',
    'Get-DrXFieldName',
    'Get-DrXMd5Hex',
    'Get-DrXSchemaBundles',
    'Import-DrXSchema',
    'Invoke-DrXDbSchemaValidation',
    'Invoke-DrXExternalApiSchemaValidation',
    'Invoke-DrXApiSchemaValidation',
    'Invoke-DrXApiSmokeTest',
    'Invoke-DrXDrupalRequest',
    'Invoke-DrXDrushPhpScript',
    'Invoke-DrXInternalApiSchemaValidation',
    'Invoke-DrXSchemaCrudValidation',
    'ConvertTo-DrXBundleName',
    'ConvertTo-DrXMachineName',
    'ConvertFrom-DrXSchemaText'
  )
  CmdletsToExport = @()
  VariablesToExport = @()
  AliasesToExport = @()
}