Set-StrictMode -Version Latest

function Get-DrXEnvMap {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Env file not found: $Path"
  }

  $values = @{}

  foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path $Path).Path)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Resolve-DrXEnvFilePath {
  param([string]$EnvFile)

  if ($EnvFile) {
    return $EnvFile
  }

  $currentDirectoryEnv = Join-Path (Get-Location).Path '.env'
  if (Test-Path $currentDirectoryEnv) {
    return $currentDirectoryEnv
  }

  return (Join-Path $PSScriptRoot '..\..\.env')
}

function Resolve-DrXSchemaPath {
  param([string]$SchemaPath)

  if ($SchemaPath) {
    return $SchemaPath
  }

  if ($env:DRX_SCHEMA_PATH) {
    return $env:DRX_SCHEMA_PATH
  }

  $envFilePath = Resolve-DrXEnvFilePath
  if (Test-Path $envFilePath) {
    $envMap = Get-DrXEnvMap -Path $envFilePath
    $configuredSchemaPath = $envMap['DRX_SCHEMA_PATH']
    if ($configuredSchemaPath) {
      if ([System.IO.Path]::IsPathRooted($configuredSchemaPath)) {
        return $configuredSchemaPath
      }

      return (Join-Path (Split-Path -Parent $envFilePath) $configuredSchemaPath)
    }
  }

  return (Join-Path $PSScriptRoot '..\v2')
}

function Get-DrXBackendCandidates {
  param([string]$ConfiguredUrl)

  $candidates = [System.Collections.Generic.List[string]]::new()

  if ($ConfiguredUrl) {
    $candidates.Add($ConfiguredUrl.TrimEnd('/'))

    try {
      $uri = [Uri]$ConfiguredUrl
      if ($uri.Host -ne 'localhost' -and $uri.Host -ne '127.0.0.1') {
        $builder = [UriBuilder]::new($uri)
        $builder.Host = 'localhost'
        $candidates.Add($builder.Uri.AbsoluteUri.TrimEnd('/'))
      }
    } catch {
    }
  }

  if ($candidates.Count -eq 0) {
    $candidates.Add('http://localhost:8080')
  }

  return $candidates | Select-Object -Unique
}

function Invoke-DrXDrupalRequest {
  param(
    [Parameter(Mandatory)]
    [string]$Method,
    [Parameter(Mandatory)]
    [string]$Uri,
    [Parameter(Mandatory)]
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body = $null,
    [hashtable]$Headers = @{},
    [string]$ContentType = 'application/json'
  )

  $request = @{
    Method = $Method
    Uri = $Uri
    WebSession = $Session
    Headers = $Headers
    ErrorAction = 'Stop'
  }

  if ($null -ne $Body) {
    $request.Body = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 }
    $request.ContentType = $ContentType
  }

  return Invoke-RestMethod @request
}

function Connect-DrXBackend {
  param([string]$EnvFile)

  $envMap = Get-DrXEnvMap -Path (Resolve-DrXEnvFilePath -EnvFile $EnvFile)
  $adminUser = $envMap['DRUPAL_ADMIN_USER']
  $adminPass = $envMap['DRUPAL_ADMIN_PASS']
  $backendUrl = $envMap['BACKEND_URL']

  if (-not $adminUser -or -not $adminPass) {
    throw 'DRUPAL_ADMIN_USER and DRUPAL_ADMIN_PASS are required in .env.'
  }

  $lastError = $null

  foreach ($candidateUrl in Get-DrXBackendCandidates -ConfiguredUrl $backendUrl) {
    $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

    try {
      $loginResponse = Invoke-DrXDrupalRequest -Method 'POST' -Uri "$candidateUrl/user/login?_format=json" -Session $session -Body @{
        name = $adminUser
        pass = $adminPass
      }

      if (-not $loginResponse.current_user.uid) {
        throw 'Login response did not include current_user.uid.'
      }

      $csrfToken = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$candidateUrl/session/token" -Session $session
      if (-not $csrfToken) {
        throw 'Session token endpoint returned an empty response.'
      }

      return [pscustomobject]@{
        EnvMap = $envMap
        BaseUrl = $candidateUrl
        Session = $session
        CsrfToken = [string]$csrfToken
        LoginResponse = $loginResponse
      }
    } catch {
      $lastError = $_
    }
  }

  if ($null -ne $lastError) {
    throw $lastError
  }

  throw 'No backend URL candidates were available to test.'
}

function Invoke-DrXApiSmokeTest {
  param([string]$EnvFile)

  $connection = Connect-DrXBackend -EnvFile $EnvFile
  $loginStatus = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)/user/login_status?_format=json" -Session $connection.Session
  if (-not $loginStatus) {
    throw 'Login status endpoint returned a falsy value.'
  }

  $jsonApiIndex = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)/jsonapi" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }

  return [pscustomobject]@{
    BackendUrl = $connection.BaseUrl
    LoginUserId = $connection.LoginResponse.current_user.uid
    LoginUserName = $connection.LoginResponse.current_user.name
    LoginStatus = [bool]$loginStatus
    CsrfToken = $connection.CsrfToken
    JsonApiLinks = @($jsonApiIndex.links.PSObject.Properties.Name)
  }
}

function Get-DrXMd5Hex {
  param([string]$Value)

  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return -join ($md5.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $md5.Dispose()
  }
}

function Set-DrXUtf8File {
  param(
    [Parameter(Mandatory)]
    [string]$Path,
    [Parameter(Mandatory)]
    [string]$Content
  )

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function ConvertTo-DrXMachineName {
  param([string]$Value)

  return (($Value.ToLowerInvariant() -replace '[^a-z0-9_]+', '_' -replace '_+', '_').Trim('_'))
}

function ConvertTo-DrXBundleName {
  param([string]$Value)

  $normalized = ConvertTo-DrXMachineName $Value
  if ($normalized.Length -le 32) {
    return $normalized
  }

  $hash = (Get-DrXMd5Hex $normalized).Substring(0, 6)
  $prefixBudget = 32 - (1 + $hash.Length)
  return '{0}_{1}' -f $normalized.Substring(0, $prefixBudget), $hash
}

function Get-DrXFieldName {
  param([string]$Key)

  $normalized = ConvertTo-DrXMachineName $Key
  $prefixed = "field_$normalized"
  if ($prefixed.Length -le 32) {
    return $prefixed
  }

  $hash = (Get-DrXMd5Hex $prefixed).Substring(0, 6)
  $prefixBudget = 32 - (1 + $hash.Length)
  return '{0}_{1}' -f $prefixed.Substring(0, $prefixBudget), $hash
}

function ConvertTo-DrXBoolean {
  param([string]$Value)

  $normalized = $Value.Trim().ToLowerInvariant()
  if ($normalized -eq 'true') { return $true }
  if ($normalized -eq 'false') { return $false }
  return [bool]$normalized
}

function ConvertTo-DrXNumber {
  param(
    [string]$Value,
    [int]$Fallback = 0
  )

  $parsed = 0
  if ([int]::TryParse($Value.Trim(), [ref]$parsed)) {
    return $parsed
  }

  $doubleValue = 0.0
  if ([double]::TryParse($Value.Trim(), [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$doubleValue)) {
    return [int]$doubleValue
  }

  return $Fallback
}

function ConvertTo-DrXUnquotedValue {
  param([string]$Value)

  $trimmed = $Value.Trim()
  if (($trimmed.StartsWith("'") -and $trimmed.EndsWith("'")) -or ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"'))) {
    return $trimmed.Substring(1, $trimmed.Length - 2)
  }

  return $trimmed
}

function ConvertTo-DrXScalarValue {
  param([string]$Value)

  $trimmed = $Value.Trim()
  if ($trimmed -eq '') {
    return ''
  }

  $unquoted = ConvertTo-DrXUnquotedValue $trimmed
  switch ($unquoted.ToLowerInvariant()) {
    'true' { return $true }
    'false' { return $false }
  }

  $intValue = 0
  if ([int]::TryParse($unquoted, [ref]$intValue)) {
    return $intValue
  }

  $doubleValue = 0.0
  if ([double]::TryParse($unquoted, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$doubleValue)) {
    return $doubleValue
  }

  return $unquoted
}

function ConvertTo-DrXInlineOptions {
  param([string]$Value)

  $match = [regex]::Match($Value.Trim(), '^\[(.*)\]$')
  if (-not $match.Success) {
    return $null
  }

  $inner = $match.Groups[1].Value.Trim()
  if (-not $inner) {
    return @()
  }

  return @($inner.Split(',') | ForEach-Object { ConvertTo-DrXUnquotedValue $_.Trim() })
}

function ConvertFrom-DrXCatalogSchemaText {
  param([string]$Text)

  $lines = ($Text -replace "`r`n", "`n") -split "`n"
  $schema = [ordered]@{
    version = 2
    catalog = [ordered]@{
      reusable_bundles = [System.Collections.ArrayList]::new()
      application_bundles = [System.Collections.ArrayList]::new()
    }
    notes = [System.Collections.ArrayList]::new()
  }

  $topLevelSection = $null
  $currentBundleListName = $null
  $currentBundle = $null
  $currentSection = $null
  $currentField = $null
  $readingFieldOptions = $false

  foreach ($raw in $lines) {
    if (-not $raw.Trim() -or $raw.Trim().StartsWith('#')) {
      continue
    }

    $indentMatch = [regex]::Match($raw, '^\s*')
    $indent = $indentMatch.Value.Length
    $line = $raw.Trim()

    if ($indent -eq 0) {
      $readingFieldOptions = $false
      $currentBundleListName = $null
      $currentBundle = $null
      $currentSection = $null
      $currentField = $null

      if ($line.StartsWith('version:')) {
        $schema['version'] = ConvertTo-DrXNumber ($line.Substring('version:'.Length)) 2
        continue
      }

      if ($line -eq 'catalog:') {
        $topLevelSection = 'catalog'
        continue
      }

      if ($line -eq 'notes:') {
        $topLevelSection = 'notes'
        continue
      }

      $topLevelSection = $null
      continue
    }

    if ($topLevelSection -eq 'notes') {
      if ($indent -eq 2 -and $line.StartsWith('- ')) {
        [void]$schema['notes'].Add((ConvertTo-DrXUnquotedValue $line.Substring(2)))
      }
      continue
    }

    if ($topLevelSection -ne 'catalog') {
      continue
    }

    if ($readingFieldOptions -and $indent -eq 16 -and $line.StartsWith('- ')) {
      [void]$currentField['options'].Add((ConvertTo-DrXUnquotedValue $line.Substring(2)))
      continue
    }

    if ($readingFieldOptions -and $indent -le 14) {
      $readingFieldOptions = $false
    }

    if ($indent -eq 2 -and ($line -eq 'reusable_bundles:' -or $line -eq 'application_bundles:')) {
      $currentBundleListName = $line.TrimEnd(':')
      $currentBundle = $null
      $currentSection = $null
      $currentField = $null
      continue
    }

    if (-not $currentBundleListName) {
      continue
    }

    if ($indent -eq 4 -and $line.StartsWith('- machine_name:')) {
      $currentBundle = [ordered]@{
        machine_name = ConvertTo-DrXUnquotedValue $line.Substring('- machine_name:'.Length)
        label = ''
        description = ''
        kind = ''
        form_id = ''
        base_bundle = ''
        system_fields = [System.Collections.ArrayList]::new()
        sections = [System.Collections.ArrayList]::new()
      }
      [void]$schema['catalog'][$currentBundleListName].Add($currentBundle)
      $currentSection = $null
      $currentField = $null
      continue
    }

    if (-not $currentBundle) {
      continue
    }

    if ($indent -eq 6 -and $line.StartsWith('label:')) {
      $currentBundle['label'] = ConvertTo-DrXUnquotedValue $line.Substring('label:'.Length)
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('description:')) {
      $currentBundle['description'] = ConvertTo-DrXUnquotedValue $line.Substring('description:'.Length)
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('kind:')) {
      $currentBundle['kind'] = ConvertTo-DrXUnquotedValue $line.Substring('kind:'.Length)
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('form_id:')) {
      $currentBundle['form_id'] = ConvertTo-DrXUnquotedValue $line.Substring('form_id:'.Length)
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('base_bundle:')) {
      $currentBundle['base_bundle'] = ConvertTo-DrXUnquotedValue $line.Substring('base_bundle:'.Length)
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('system_fields:')) {
      $currentSection = [ordered]@{
        id = '__system_fields__'
        title = 'System Fields'
        description = 'Non-visual fields stored on the bundle.'
        fields = $currentBundle['system_fields']
      }
      $currentField = $null
      continue
    }
    if ($indent -eq 6 -and $line.StartsWith('sections:')) {
      $currentSection = $null
      continue
    }

    if ($indent -eq 8 -and $line.StartsWith('- id:')) {
      $currentSection = [ordered]@{
        id = ConvertTo-DrXUnquotedValue $line.Substring('- id:'.Length)
        title = ''
        description = ''
        fields = [System.Collections.ArrayList]::new()
      }
      [void]$currentBundle['sections'].Add($currentSection)
      $currentField = $null
      continue
    }

    if (-not $currentSection) {
      continue
    }

    if ($indent -eq 10 -and $line.StartsWith('title:')) {
      $currentSection['title'] = ConvertTo-DrXUnquotedValue $line.Substring('title:'.Length)
      continue
    }
    if ($indent -eq 10 -and $line.StartsWith('description:')) {
      $currentSection['description'] = ConvertTo-DrXUnquotedValue $line.Substring('description:'.Length)
      continue
    }
    if ($indent -eq 10 -and $line.StartsWith('fields:')) {
      continue
    }

    if ($currentSection['id'] -eq '__system_fields__' -and $indent -eq 8 -and $line.StartsWith('- key:')) {
      $currentField = [ordered]@{
        key = ConvertTo-DrXUnquotedValue $line.Substring('- key:'.Length)
        label = ''
        type = 'text'
        required = $false
        default = $null
        has_default = $false
        options = [System.Collections.ArrayList]::new()
        target_bundles = [System.Collections.ArrayList]::new()
        description = ''
      }
      [void]$currentSection['fields'].Add($currentField)
      continue
    }

    if ($indent -eq 12 -and $line.StartsWith('- key:')) {
      $currentField = [ordered]@{
        key = ConvertTo-DrXUnquotedValue $line.Substring('- key:'.Length)
        label = ''
        type = 'text'
        required = $false
        default = $null
        has_default = $false
        options = [System.Collections.ArrayList]::new()
        target_bundles = [System.Collections.ArrayList]::new()
        description = ''
      }
      [void]$currentSection['fields'].Add($currentField)
      continue
    }

    if (-not $currentField -or $indent -ne 14) {
      continue
    }

    if ($line.StartsWith('label:')) {
      $currentField['label'] = ConvertTo-DrXUnquotedValue $line.Substring('label:'.Length)
      continue
    }
    if ($line.StartsWith('type:')) {
      $currentField['type'] = ConvertTo-DrXUnquotedValue $line.Substring('type:'.Length)
      continue
    }
    if ($line.StartsWith('required:')) {
      $currentField['required'] = ConvertTo-DrXBoolean $line.Substring('required:'.Length)
      continue
    }
    if ($line.StartsWith('default:')) {
      $currentField['default'] = ConvertTo-DrXScalarValue $line.Substring('default:'.Length)
      $currentField['has_default'] = $true
      continue
    }
    if ($line.StartsWith('description:')) {
      $currentField['description'] = ConvertTo-DrXUnquotedValue $line.Substring('description:'.Length)
      continue
    }
    if ($line.StartsWith('contact_kind:')) {
      $currentField['contact_kind'] = ConvertTo-DrXUnquotedValue $line.Substring('contact_kind:'.Length)
      continue
    }
    if ($line.StartsWith('cardinality:')) {
      $currentField['cardinality'] = ConvertTo-DrXNumber ($line.Substring('cardinality:'.Length)) 1
      continue
    }
    if ($line.StartsWith('target_bundles:')) {
      $rawTargetBundles = $line.Substring('target_bundles:'.Length).Trim()
      $currentField['target_bundles'] = [System.Collections.ArrayList]::new()
      foreach ($bundleName in (ConvertTo-DrXInlineOptions $rawTargetBundles)) {
        [void]$currentField['target_bundles'].Add($bundleName)
      }
      continue
    }
    if ($line.StartsWith('auto_create:')) {
      $currentField['auto_create'] = ConvertTo-DrXBoolean $line.Substring('auto_create:'.Length)
      continue
    }
    if ($line.StartsWith('options:')) {
      $rawOptions = $line.Substring('options:'.Length).Trim()
      if (-not $rawOptions) {
        $readingFieldOptions = $true
        $currentField['options'] = [System.Collections.ArrayList]::new()
      } else {
        $currentField['options'] = [System.Collections.ArrayList]::new()
        foreach ($option in (ConvertTo-DrXInlineOptions $rawOptions)) {
          [void]$currentField['options'].Add($option)
        }
      }
    }
  }

  return $schema
}

function ConvertFrom-DrXSchemaText {
  param([string]$Text)

  $hasCatalog = $Text.Contains('catalog:')
  $hasReusableBundles = $Text.Contains('reusable_bundles:')
  $hasApplicationBundles = $Text.Contains('application_bundles:')

  if (-not $hasCatalog -or (-not $hasReusableBundles -and -not $hasApplicationBundles)) {
    throw 'Unsupported schema format. This module only supports schema v2 catalog format.'
  }

  return ConvertFrom-DrXCatalogSchemaText -Text $Text
}

function Join-DrXCatalogSchemas {
  param([object[]]$ParsedSchemas)

  $merged = [ordered]@{
    version = 2
    catalog = [ordered]@{
      reusable_bundles = [System.Collections.ArrayList]::new()
      application_bundles = [System.Collections.ArrayList]::new()
    }
    notes = [System.Collections.ArrayList]::new()
  }

  foreach ($schema in $ParsedSchemas) {
    if ($schema['version']) {
      $merged['version'] = [Math]::Max([int]$merged['version'], [int]$schema['version'])
    }

    foreach ($bundle in $schema['catalog']['reusable_bundles']) {
      [void]$merged['catalog']['reusable_bundles'].Add($bundle)
    }
    foreach ($bundle in $schema['catalog']['application_bundles']) {
      [void]$merged['catalog']['application_bundles'].Add($bundle)
    }
    foreach ($note in $schema['notes']) {
      [void]$merged['notes'].Add($note)
    }
  }

  return $merged
}

function Import-DrXSchema {
  param([string]$SchemaPath)

  $resolvedSchemaPath = Resolve-DrXSchemaPath -SchemaPath $SchemaPath
  $resolvedPath = (Resolve-Path -Path $resolvedSchemaPath -ErrorAction Stop).Path
  $item = Get-Item $resolvedPath
  if ($item.PSIsContainer) {
    $files = Get-ChildItem -Path $resolvedPath -Filter *.y*ml | Sort-Object Name
    if ($files.Count -eq 0) {
      throw "No schema YAML files found in directory: $SchemaPath"
    }

    $parsedSchemas = @()
    foreach ($file in $files) {
      $parsedSchemas += ConvertFrom-DrXSchemaText -Text ([System.IO.File]::ReadAllText($file.FullName))
    }
    return Join-DrXCatalogSchemas -ParsedSchemas $parsedSchemas
  }

  return ConvertFrom-DrXSchemaText -Text ([System.IO.File]::ReadAllText($resolvedPath))
}

function Copy-DrXFieldCollection {
  param(
    [object[]]$Fields,
    [hashtable]$BundleNameMap
  )

  if (-not $Fields) {
    return @()
  }

  $result = [System.Collections.ArrayList]::new()

  foreach ($field in $Fields) {
    $normalizedField = [ordered]@{}
    foreach ($property in $field.GetEnumerator()) {
      if ($property.Value -is [System.Collections.IEnumerable] -and -not ($property.Value -is [string])) {
        if ($property.Key -eq 'options' -or $property.Key -eq 'target_bundles') {
          $normalizedField[$property.Key] = [System.Collections.ArrayList]::new()
          foreach ($item in $property.Value) {
            [void]$normalizedField[$property.Key].Add($item)
          }
        } else {
          $normalizedField[$property.Key] = $property.Value
        }
      } else {
        $normalizedField[$property.Key] = $property.Value
      }
    }

    if ($field.Contains('target_bundles')) {
      $normalizedField['target_bundles'] = [System.Collections.ArrayList]::new()
      foreach ($bundle in $field['target_bundles']) {
        $normalized = ConvertTo-DrXMachineName $bundle
        $resolved = if ($BundleNameMap.ContainsKey($normalized)) { $BundleNameMap[$normalized] } else { ConvertTo-DrXBundleName $bundle }
        [void]$normalizedField['target_bundles'].Add($resolved)
      }
    }

    if ($field.Contains('options')) {
      $normalizedField['options'] = [System.Collections.ArrayList]::new()
      foreach ($option in $field['options']) {
        $normalized = ConvertTo-DrXMachineName $option
        $resolved = if ($BundleNameMap.ContainsKey($normalized)) { $BundleNameMap[$normalized] } else { $option }
        [void]$normalizedField['options'].Add($resolved)
      }
    }

    if ($normalizedField['key'] -eq 'pages' -and $normalizedField.Contains('options')) {
      $normalizedOptions = [System.Collections.ArrayList]::new()
      foreach ($option in $normalizedField['options']) {
        $normalized = ConvertTo-DrXMachineName $option
        $resolved = if ($BundleNameMap.ContainsKey($normalized)) { $BundleNameMap[$normalized] } else { ConvertTo-DrXBundleName $option }
        [void]$normalizedOptions.Add($resolved)
      }
      $normalizedField['options'] = $normalizedOptions
    }

    [void]$result.Add($normalizedField)
  }

  return @($result)
}

function ConvertTo-DrXNormalizedSchema {
  param([object]$ParsedSchema)

  $reusableBundles = @($ParsedSchema['catalog']['reusable_bundles'])
  $applicationBundles = @($ParsedSchema['catalog']['application_bundles'])
  $allBundles = @($reusableBundles + $applicationBundles)
  $bundleNameMap = @{}

  foreach ($bundle in $allBundles) {
    $sourceName = if ($bundle['machine_name']) { $bundle['machine_name'] } elseif ($bundle['label']) { $bundle['label'] } else { 'application' }
    $normalizedName = ConvertTo-DrXBundleName $sourceName
    foreach ($aliasValue in @($bundle['machine_name'], $bundle['label'])) {
      if ($aliasValue) {
        $bundleNameMap[(ConvertTo-DrXMachineName $aliasValue)] = $normalizedName
      }
    }
  }

  $normalizedBundles = [System.Collections.ArrayList]::new()
  foreach ($bundle in $allBundles) {
    $sourceName = if ($bundle['machine_name']) { $bundle['machine_name'] } elseif ($bundle['label']) { $bundle['label'] } else { 'application' }
    $normalizedBundle = [ordered]@{
      machine_name = ConvertTo-DrXBundleName $sourceName
      label = if ($bundle['label']) { $bundle['label'] } elseif ($bundle['machine_name']) { $bundle['machine_name'] } else { 'Application' }
      description = if ($bundle['description']) { $bundle['description'] } else { 'Generated from form schema catalog' }
      kind = if ($bundle['kind']) { $bundle['kind'] } else { 'bundle' }
      form_id = if ($bundle['form_id']) { $bundle['form_id'] } else { '' }
      base_bundle = if ($bundle['base_bundle']) { ConvertTo-DrXBundleName $bundle['base_bundle'] } else { '' }
      system_fields = @(Copy-DrXFieldCollection -Fields $bundle['system_fields'] -BundleNameMap $bundleNameMap)
      sections = [System.Collections.ArrayList]::new()
    }

    foreach ($section in @($bundle['sections'])) {
      $normalizedSection = [ordered]@{}
      foreach ($property in $section.GetEnumerator()) {
        if ($property.Key -eq 'fields') {
          $normalizedSection['fields'] = @(Copy-DrXFieldCollection -Fields $section['fields'] -BundleNameMap $bundleNameMap)
        } else {
          $normalizedSection[$property.Key] = $property.Value
        }
      }
      [void]$normalizedBundle['sections'].Add($normalizedSection)
    }

    [void]$normalizedBundles.Add($normalizedBundle)
  }

  return [ordered]@{
    version = if ($ParsedSchema['version']) { $ParsedSchema['version'] } else { 2 }
    bundles = @($normalizedBundles)
  }
}

function Get-DrXSchemaBundles {
  param([string]$SchemaPath)

  $normalizedSchema = ConvertTo-DrXNormalizedSchema -ParsedSchema (Import-DrXSchema -SchemaPath $SchemaPath)
  return @($normalizedSchema['bundles'] | ForEach-Object {
    [pscustomobject]@{
      SchemaMachineName = $_['machine_name']
      Bundle = $_['machine_name']
      Label = $_['label']
      Kind = $_['kind']
    }
  } | Sort-Object Bundle -Unique)
}

function Get-DrXFieldMapping {
  param([hashtable]$Field)

  $type = ([string]$Field['type']).ToLowerInvariant()

  if ($type -eq 'boolean') {
    return [ordered]@{
      storageType = 'boolean'
      module = 'core'
      storageSettings = [ordered]@{ on_label = 'On'; off_label = 'Off' }
      instanceSettings = [ordered]@{ display_label = $true }
    }
  }

  if ($type -eq 'textarea' -or $type -eq 'signature') {
    return [ordered]@{
      storageType = 'text_long'
      module = 'text'
      storageSettings = [ordered]@{}
      instanceSettings = [ordered]@{}
    }
  }

  if ($type -eq 'email') {
    return [ordered]@{
      storageType = 'email'
      module = 'core'
      storageSettings = [ordered]@{}
      instanceSettings = [ordered]@{}
    }
  }

  if ($type -eq 'date') {
    return [ordered]@{
      storageType = 'datetime'
      module = 'datetime'
      storageSettings = [ordered]@{ datetime_type = 'date' }
      instanceSettings = [ordered]@{}
    }
  }

  if (($type -eq 'radio' -or $type -eq 'select') -and $Field['options'] -and @($Field['options']).Count -gt 0) {
    $allowedValues = [System.Collections.ArrayList]::new()
    foreach ($option in @($Field['options'])) {
      [void]$allowedValues.Add([ordered]@{ value = $option; label = $option })
    }

    return [ordered]@{
      storageType = 'list_string'
      module = 'options'
      storageSettings = [ordered]@{
        allowed_values = @($allowedValues)
        allowed_values_function = ''
      }
      instanceSettings = [ordered]@{}
    }
  }

  if ($type -eq 'phone') {
    return [ordered]@{
      storageType = 'string'
      module = 'core'
      storageSettings = [ordered]@{ max_length = 64; is_ascii = $false; case_sensitive = $false }
      instanceSettings = [ordered]@{}
    }
  }

  if ($type -eq 'typed_contact_list') {
    return [ordered]@{
      storageType = 'string'
      module = 'core'
      storageSettings = [ordered]@{ max_length = 255; is_ascii = $false; case_sensitive = $false }
      instanceSettings = [ordered]@{}
    }
  }

  $nodeReferenceMap = @{
    address_reference = 'address'
    person_reference = 'person'
    student_reference = 'student'
  }

  if ($nodeReferenceMap.ContainsKey($type)) {
    $targetBundle = $nodeReferenceMap[$type]
    return [ordered]@{
      storageType = 'entity_reference'
      module = 'core'
      storageSettings = [ordered]@{ target_type = 'node' }
      instanceSettings = [ordered]@{
        handler = 'default:node'
        handler_settings = [ordered]@{
          target_bundles = [ordered]@{ $targetBundle = $targetBundle }
          sort = [ordered]@{ field = '_none' }
          auto_create = $false
          auto_create_bundle = ''
        }
      }
      translatable = $true
      configDependencies = @("node.type.$targetBundle")
    }
  }

  if ($type -eq 'node_reference') {
    $targetBundles = @()
    foreach ($bundle in @($Field['target_bundles'])) {
      $normalized = ConvertTo-DrXBundleName $bundle
      if ($normalized) {
        $targetBundles += $normalized
      }
    }

    $targetBundleMap = [ordered]@{}
    foreach ($bundle in $targetBundles) {
      $targetBundleMap[$bundle] = $bundle
    }

    return [ordered]@{
      storageType = 'entity_reference'
      module = 'core'
      storageSettings = [ordered]@{ target_type = 'node' }
      instanceSettings = [ordered]@{
        handler = 'default:node'
        handler_settings = [ordered]@{
          target_bundles = $targetBundleMap
          sort = [ordered]@{ field = '_none' }
          auto_create = [bool]$Field['auto_create']
          auto_create_bundle = ''
        }
      }
      translatable = $true
      configDependencies = @($targetBundles | ForEach-Object { "node.type.$_" })
    }
  }

  return [ordered]@{
    storageType = 'string'
    module = 'core'
    storageSettings = [ordered]@{ max_length = 255; is_ascii = $false; case_sensitive = $false }
    instanceSettings = [ordered]@{}
  }
}

function Format-DrXYamlScalar {
  param([object]$Value)

  if ($Value -is [bool]) {
    return $(if ($Value) { 'true' } else { 'false' })
  }
  if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int] -or $Value -is [int64] -or $Value -is [double] -or $Value -is [decimal]) {
    return [string]$Value
  }
  if ($null -eq $Value) {
    return "''"
  }

  $stringValue = [string]$Value
  if ($stringValue -eq '') {
    return "''"
  }

  if ($stringValue -match '[:#{}\[\],&*!?|<>=''"%@`]|^\s|\s$') {
    return "'" + $stringValue.Replace("'", "''") + "'"
  }

  return $stringValue
}

function ConvertTo-DrXYaml {
  param(
    [object]$Value,
    [int]$Indent = 0
  )

  $sp = ' ' * $Indent

  if ($null -ne $Value -and -not ($Value -is [string]) -and $Value -is [System.Collections.IEnumerable] -and -not ($Value -is [System.Collections.IDictionary]) -and -not ($Value -is [pscustomobject])) {
    $items = @($Value)
    if ($items.Count -eq 0) {
      return "$sp[]"
    }

    $lines = foreach ($item in $items) {
      if (($item -is [System.Collections.IDictionary]) -or ($item -is [pscustomobject]) -or ($item -is [System.Collections.IEnumerable] -and -not ($item -is [string]))) {
        $nested = ConvertTo-DrXYaml -Value $item -Indent ($Indent + 2)
        $nestedLines = $nested -split "`n"
        $first = $nestedLines[0].TrimStart()
        $rest = @($nestedLines | Select-Object -Skip 1)
        if ($rest.Count -eq 0) {
          "$sp- $first"
        } else {
          "$sp- $first`n$($rest -join "`n")"
        }
      } else {
        "$sp- $(Format-DrXYamlScalar $item)"
      }
    }
    return ($lines -join "`n")
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $entries = @($Value.GetEnumerator())
    if ($entries.Count -eq 0) {
      return "$sp{}"
    }

    $lines = foreach ($entry in $entries) {
      $key = [string]$entry.Key
      $entryValue = $entry.Value
      if (($entryValue -is [System.Collections.IDictionary]) -or ($entryValue -is [pscustomobject]) -or ($entryValue -is [System.Collections.IEnumerable] -and -not ($entryValue -is [string]))) {
        $nested = ConvertTo-DrXYaml -Value $entryValue -Indent ($Indent + 2)
        $trimmed = $nested.Trim()
        if ($trimmed -eq '[]' -or $trimmed -eq '{}') {
          "${sp}${key}: $trimmed"
        } else {
          "${sp}${key}:`n$nested"
        }
      } else {
        "${sp}${key}: $(Format-DrXYamlScalar $entryValue)"
      }
    }
    return ($lines -join "`n")
  }

  if ($Value -is [pscustomobject]) {
    $ordered = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
      $ordered[$property.Name] = $property.Value
    }
    return ConvertTo-DrXYaml -Value $ordered -Indent $Indent
  }

  return "$sp$(Format-DrXYamlScalar $Value)"
}

function New-DrXNodeTypeConfig {
  param([hashtable]$Bundle)

  return [ordered]@{
    langcode = 'en'
    status = $true
    dependencies = [ordered]@{ module = @('node') }
    name = if ($Bundle['label']) { $Bundle['label'] } else { 'Application' }
    type = if ($Bundle['machine_name']) { $Bundle['machine_name'] } else { 'application' }
    description = if ($Bundle['description']) { $Bundle['description'] } else { 'Generated application content type' }
    help = ''
    new_revision = $false
    preview_mode = 1
    display_submitted = $false
  }
}

function Get-DrXFormDisplayComponent {
  param(
    [hashtable]$Field,
    [hashtable]$Mapping,
    [int]$Weight
  )

  $type = ([string]$Field['type']).ToLowerInvariant()

  if ($type -eq 'textarea' -or $type -eq 'signature') {
    return [ordered]@{ type = 'text_textarea'; weight = $Weight; region = 'content'; settings = [ordered]@{ rows = 5; placeholder = '' }; third_party_settings = [ordered]@{} }
  }
  if ($type -eq 'email') {
    return [ordered]@{ type = 'email_default'; weight = $Weight; region = 'content'; settings = [ordered]@{ size = 60; placeholder = '' }; third_party_settings = [ordered]@{} }
  }
  if ($type -eq 'date') {
    return [ordered]@{ type = 'datetime_default'; weight = $Weight; region = 'content'; settings = [ordered]@{}; third_party_settings = [ordered]@{} }
  }
  if ($type -eq 'radio') {
    return [ordered]@{ type = 'options_buttons'; weight = $Weight; region = 'content'; settings = [ordered]@{}; third_party_settings = [ordered]@{} }
  }
  if ($type -eq 'select') {
    return [ordered]@{ type = 'options_select'; weight = $Weight; region = 'content'; settings = [ordered]@{}; third_party_settings = [ordered]@{} }
  }
  if ($type -eq 'boolean') {
    return [ordered]@{ type = 'boolean_checkbox'; weight = $Weight; region = 'content'; settings = [ordered]@{ display_label = $true }; third_party_settings = [ordered]@{} }
  }
  if ($Mapping['storageType'] -eq 'entity_reference') {
    return [ordered]@{ type = 'entity_reference_autocomplete'; weight = $Weight; region = 'content'; settings = [ordered]@{ match_operator = 'CONTAINS'; match_limit = 10; size = 60; placeholder = '' }; third_party_settings = [ordered]@{} }
  }

  return [ordered]@{ type = 'string_textfield'; weight = $Weight; region = 'content'; settings = [ordered]@{ size = 60; placeholder = '' }; third_party_settings = [ordered]@{} }
}

function Get-DrXViewDisplayComponent {
  param(
    [hashtable]$Field,
    [hashtable]$Mapping,
    [int]$Weight
  )

  $type = ([string]$Field['type']).ToLowerInvariant()

  if ($type -eq 'textarea' -or $type -eq 'signature') {
    return [ordered]@{ type = 'text_default'; label = 'above'; settings = [ordered]@{}; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
  }
  if ($type -eq 'email') {
    return [ordered]@{ type = 'email_mailto'; label = 'above'; settings = [ordered]@{}; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
  }
  if ($type -eq 'date') {
    return [ordered]@{ type = 'datetime_default'; label = 'above'; settings = [ordered]@{ timezone_override = ''; format_type = 'medium' }; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
  }
  if ($type -eq 'boolean') {
    return [ordered]@{ type = 'boolean'; label = 'above'; settings = [ordered]@{ format = 'default'; format_custom_true = ''; format_custom_false = '' }; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
  }
  if ($Mapping['storageType'] -eq 'entity_reference') {
    return [ordered]@{ type = 'entity_reference_label'; label = 'above'; settings = [ordered]@{ link = $true }; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
  }

  return [ordered]@{ type = 'string'; label = 'above'; settings = [ordered]@{ link_to_entity = $false }; third_party_settings = [ordered]@{}; weight = $Weight; region = 'content' }
}

function Get-DrXBundleFieldEntries {
  param(
    [hashtable]$Bundle,
    [hashtable]$BundleMap,
    [string[]]$Visited = @()
  )

  $bundleId = $Bundle['machine_name']
  if ($Visited -contains $bundleId) {
    throw "Circular base_bundle chain detected for bundle: $bundleId"
  }

  $nextVisited = @($Visited + $bundleId)
  $entries = [System.Collections.ArrayList]::new()

  if ($Bundle['base_bundle']) {
    if (-not $BundleMap.ContainsKey($Bundle['base_bundle'])) {
      throw "Bundle $bundleId references missing base_bundle $($Bundle['base_bundle'])"
    }
    foreach ($entry in (Get-DrXBundleFieldEntries -Bundle $BundleMap[$Bundle['base_bundle']] -BundleMap $BundleMap -Visited $nextVisited)) {
      [void]$entries.Add($entry)
    }
  }

  foreach ($field in @($Bundle['system_fields'])) {
    [void]$entries.Add([ordered]@{ section = $null; field = $field })
  }

  foreach ($section in @($Bundle['sections'])) {
    foreach ($field in @($section['fields'])) {
      [void]$entries.Add([ordered]@{ section = $section; field = $field })
    }
  }

  return @($entries)
}

function New-DrXEntityFormDisplayConfig {
  param(
    [hashtable]$Bundle,
    [object[]]$FieldEntries
  )

  $configDependencies = [System.Collections.ArrayList]::new()
  [void]$configDependencies.Add("node.type.$($Bundle['machine_name'])")
  $moduleDependencies = [System.Collections.Generic.HashSet[string]]::new()
  [void]$moduleDependencies.Add('node')
  $content = [ordered]@{}

  for ($index = 0; $index -lt $FieldEntries.Count; $index += 1) {
    $entry = $FieldEntries[$index]
    $fieldName = Get-DrXFieldName ($entry['field']['key'])
    [void]$configDependencies.Add("field.field.node.$($Bundle['machine_name']).$fieldName")
    if ($entry['mapping']['module'] -and $entry['mapping']['module'] -ne 'core') {
      [void]$moduleDependencies.Add([string]$entry['mapping']['module'])
    }
    $content[$fieldName] = Get-DrXFormDisplayComponent -Field $entry['field'] -Mapping $entry['mapping'] -Weight $index
  }

  return [ordered]@{
    langcode = 'en'
    status = $true
    dependencies = [ordered]@{
      config = @($configDependencies)
      module = @($moduleDependencies)
    }
    id = "node.$($Bundle['machine_name']).default"
    targetEntityType = 'node'
    bundle = $Bundle['machine_name']
    mode = 'default'
    content = $content
    hidden = [ordered]@{}
  }
}

function New-DrXEntityViewDisplayConfig {
  param(
    [hashtable]$Bundle,
    [object[]]$FieldEntries
  )

  $configDependencies = [System.Collections.ArrayList]::new()
  [void]$configDependencies.Add("node.type.$($Bundle['machine_name'])")
  $moduleDependencies = [System.Collections.Generic.HashSet[string]]::new()
  [void]$moduleDependencies.Add('node')
  $content = [ordered]@{}

  for ($index = 0; $index -lt $FieldEntries.Count; $index += 1) {
    $entry = $FieldEntries[$index]
    $fieldName = Get-DrXFieldName ($entry['field']['key'])
    [void]$configDependencies.Add("field.field.node.$($Bundle['machine_name']).$fieldName")
    if ($entry['mapping']['module'] -and $entry['mapping']['module'] -ne 'core') {
      [void]$moduleDependencies.Add([string]$entry['mapping']['module'])
    }
    $content[$fieldName] = Get-DrXViewDisplayComponent -Field $entry['field'] -Mapping $entry['mapping'] -Weight $index
  }

  return [ordered]@{
    langcode = 'en'
    status = $true
    dependencies = [ordered]@{
      config = @($configDependencies)
      module = @($moduleDependencies)
    }
    id = "node.$($Bundle['machine_name']).default"
    targetEntityType = 'node'
    bundle = $Bundle['machine_name']
    mode = 'default'
    content = $content
    hidden = [ordered]@{}
  }
}

function New-DrXStorageConfig {
  param(
    [string]$FieldName,
    [hashtable]$Mapping,
    [hashtable]$Field
  )

  $deps = [System.Collections.ArrayList]::new()
  [void]$deps.Add('node')
  if ($Mapping['module'] -ne 'core') {
    [void]$deps.Add($Mapping['module'])
  }

  return [ordered]@{
    langcode = 'en'
    status = $true
    dependencies = [ordered]@{ module = @($deps) }
    id = "node.$FieldName"
    field_name = $FieldName
    entity_type = 'node'
    type = $Mapping['storageType']
    settings = $Mapping['storageSettings']
    module = $Mapping['module']
    locked = $false
    cardinality = if ($Field.Contains('cardinality')) { [int]$Field['cardinality'] } else { 1 }
    translatable = [bool]$Mapping['translatable']
    indexes = [ordered]@{}
    persist_with_no_fields = $false
    custom_storage = $false
  }
}

function New-DrXInstanceConfig {
  param(
    [string]$Bundle,
    [string]$FieldName,
    [hashtable]$Field,
    [hashtable]$Mapping,
    [hashtable]$Section
  )

  $configDependencies = [System.Collections.ArrayList]::new()
  [void]$configDependencies.Add("field.storage.node.$FieldName")
  [void]$configDependencies.Add("node.type.$Bundle")

  $description = if ($Field['description']) {
    $Field['description']
  } elseif ($Section) {
    "Section: $($Section['title'])"
  } else {
    ''
  }

  if (-not $description -and $Field['type'] -eq 'typed_contact_list' -and $Field['contact_kind']) {
    $description = "Store one $($Field['contact_kind']) per line using type:value formatting."
  }

  foreach ($dependency in @($Mapping['configDependencies'])) {
    if ($dependency) {
      [void]$configDependencies.Add($dependency)
    }
  }

  $defaultValue = [ordered]@{}
  if ($Field['has_default']) {
    if ($Mapping['storageType'] -eq 'entity_reference') {
      $defaultValue = [ordered]@{}
    } elseif ($Mapping['storageType'] -eq 'boolean') {
      $defaultValue = @([ordered]@{ value = $(if ($Field['default']) { 1 } else { 0 }) })
    } else {
      $defaultValue = @([ordered]@{ value = $Field['default'] })
    }
  }

  return [ordered]@{
    langcode = 'en'
    status = $true
    dependencies = [ordered]@{ config = @($configDependencies) }
    id = "node.$Bundle.$FieldName"
    field_name = $FieldName
    entity_type = 'node'
    bundle = $Bundle
    label = $Field['label']
    description = $description
    required = [bool]$Field['required']
    translatable = $false
    default_value = $defaultValue
    default_value_callback = ''
    settings = $Mapping['instanceSettings']
    field_type = $Mapping['storageType']
  }
}

function Export-DrXDrupalScaffoldConfig {
  param(
    [string]$SchemaPath = $null,
    [string]$OutputDir = (Join-Path $PSScriptRoot '..\..\backend\config\generated')
  )

  $normalizedSchema = ConvertTo-DrXNormalizedSchema -ParsedSchema (Import-DrXSchema -SchemaPath $SchemaPath)
  if (-not $normalizedSchema['bundles'] -or @($normalizedSchema['bundles']).Count -eq 0) {
    throw 'No bundles found in schema input.'
  }

  $resolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDir)
  [System.IO.Directory]::CreateDirectory($resolvedOutputDir) | Out-Null

  $bundleMap = @{}
  foreach ($bundle in @($normalizedSchema['bundles'])) {
    $bundleMap[$bundle['machine_name']] = $bundle
  }

  $writtenFields = [System.Collections.Generic.HashSet[string]]::new()
  $writtenBundles = [System.Collections.ArrayList]::new()

  foreach ($bundle in @($normalizedSchema['bundles'])) {
    $nodeTypeFile = Join-Path $resolvedOutputDir "node.type.$($bundle['machine_name']).yml"
    Set-DrXUtf8File -Path $nodeTypeFile -Content ((ConvertTo-DrXYaml -Value (New-DrXNodeTypeConfig -Bundle $bundle)) + "`n")
    [void]$writtenBundles.Add($bundle['machine_name'])

    $fieldEntries = [System.Collections.ArrayList]::new()
    foreach ($entry in (Get-DrXBundleFieldEntries -Bundle $bundle -BundleMap $bundleMap)) {
      $field = $entry['field']
      $fieldName = Get-DrXFieldName ($field['key'])
      $mapping = Get-DrXFieldMapping -Field $field
      $storage = New-DrXStorageConfig -FieldName $fieldName -Mapping $mapping -Field $field
      $instance = New-DrXInstanceConfig -Bundle $bundle['machine_name'] -FieldName $fieldName -Field $field -Mapping $mapping -Section $entry['section']

      if (-not $writtenFields.Contains($fieldName)) {
        $storagePath = Join-Path $resolvedOutputDir "field.storage.node.$fieldName.yml"
        Set-DrXUtf8File -Path $storagePath -Content ((ConvertTo-DrXYaml -Value $storage) + "`n")
        [void]$writtenFields.Add($fieldName)
      }

      $instancePath = Join-Path $resolvedOutputDir "field.field.node.$($bundle['machine_name']).$fieldName.yml"
      Set-DrXUtf8File -Path $instancePath -Content ((ConvertTo-DrXYaml -Value $instance) + "`n")

      [void]$fieldEntries.Add([ordered]@{ section = $entry['section']; field = $field; mapping = $mapping })
    }

    $formDisplayPath = Join-Path $resolvedOutputDir "core.entity_form_display.node.$($bundle['machine_name']).default.yml"
    Set-DrXUtf8File -Path $formDisplayPath -Content ((ConvertTo-DrXYaml -Value (New-DrXEntityFormDisplayConfig -Bundle $bundle -FieldEntries @($fieldEntries))) + "`n")

    $viewDisplayPath = Join-Path $resolvedOutputDir "core.entity_view_display.node.$($bundle['machine_name']).default.yml"
    Set-DrXUtf8File -Path $viewDisplayPath -Content ((ConvertTo-DrXYaml -Value (New-DrXEntityViewDisplayConfig -Bundle $bundle -FieldEntries @($fieldEntries))) + "`n")
  }

  return [pscustomobject]@{
    OutputDir = $resolvedOutputDir
    Bundles = @($writtenBundles)
    FieldCount = $writtenFields.Count
  }
}

function Invoke-DrXDrushPhpScript {
  param(
    [Parameter(Mandatory)]
    [string]$PhpContents,
    [string]$ComposeService = 'backend',
    [string]$ContainerPhpPath = '/tmp/newschool-backend-testing.php'
  )

  $phpTempPath = Join-Path ([System.IO.Path]::GetTempPath()) ('newschool-backend-testing-{0}.php' -f [System.Guid]::NewGuid().ToString('N'))

  try {
    Set-DrXUtf8File -Path $phpTempPath -Content $PhpContents

    & docker compose cp $phpTempPath "${ComposeService}:${ContainerPhpPath}" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'docker compose cp failed.'
    }

    $output = & docker compose exec $ComposeService bash -lc "sudo -u www-data /var/www/html/vendor/bin/drush php:script $ContainerPhpPath" 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw (($output | Out-String).Trim())
    }

    $normalizedOutput = ($output | Out-String).Trim()
    return $normalizedOutput.TrimStart([char]0xFEFF)
  }
  finally {
    if (Test-Path $phpTempPath) {
      Remove-Item $phpTempPath -Force
    }

    try {
      & docker compose exec $ComposeService bash -lc "rm -f $ContainerPhpPath" | Out-Null
    } catch {
    }
  }
}

function New-DrXSchemaCrudValidatorPhp {
  param([object[]]$Bundles)

  $bundleList = ($Bundles | ForEach-Object { "    '{0}'" -f $_.Bundle }) -join ",`n"

  @'
<?php

use Drupal\node\Entity\Node;






$bundles = [
__BUNDLE_LIST__
];

$results = [];
$failed = false;

foreach ($bundles as $bundle) {
    $title = sprintf('Schema validator %s %s', $bundle, substr(hash('sha256', microtime(true) . $bundle . random_int(1, PHP_INT_MAX)), 0, 8));

    try {
        $node = Node::create([
            'type' => $bundle,
            'title' => $title,
            'status' => FALSE,
        ]);
        $node->save();

        $nid = (int) $node->id();
        $uuid = $node->uuid();

        $loaded = Node::load($nid);
        if (!$loaded) {
            throw new RuntimeException('Read after create failed.');
        }

        if ($loaded->bundle() !== $bundle) {
            throw new RuntimeException(sprintf('Expected bundle %s, got %s.', $bundle, $loaded->bundle()));
        }

        $updatedTitle = $title . ' updated';
        $loaded->setTitle($updatedTitle);
        $loaded->save();

        $reloaded = Node::load($nid);
        if (!$reloaded) {
            throw new RuntimeException('Read after update failed.');
        }

        if ($reloaded->label() !== $updatedTitle) {
            throw new RuntimeException('Updated title was not persisted.');
        }

        $reloaded->delete();

        if (Node::load($nid)) {
            throw new RuntimeException('Delete failed; node still loads by ID.');
        }

        $results[] = [
            'bundle' => $bundle,
            'nid' => $nid,
            'uuid' => $uuid,
            'status' => 'ok',
        ];
    }
    catch (Throwable $exception) {
        $failed = true;
        $results[] = [
            'bundle' => $bundle,
            'status' => 'error',
            'message' => $exception->getMessage(),
        ];
    }
}

print json_encode([
    'failed' => $failed,
    'results' => $results,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

if ($failed) {
  throw new RuntimeException('Schema CRUD validation failed.');
}
'@.Replace('__BUNDLE_LIST__', $bundleList)
}

function Invoke-DrXDbSchemaValidation {
  param(
    [string]$SchemaPath = $null,
    [string]$ComposeService = 'backend'
  )

  $schemaBundles = @(Get-DrXSchemaBundles -SchemaPath $SchemaPath)
  if ($schemaBundles.Count -eq 0) {
    throw 'No bundles were found in the schema directory.'
  }

  return Invoke-DrXDrushPhpScript -PhpContents (New-DrXSchemaCrudValidatorPhp -Bundles $schemaBundles) -ComposeService $ComposeService -ContainerPhpPath '/tmp/schema-validator.php'
}

function New-DrXApiSchemaFixturePhp {
  param([object[]]$Bundles)

  $bundleList = ($Bundles | ForEach-Object { "    '{0}'" -f $_.Bundle }) -join ",`n"

  @'
<?php

use Drupal\node\Entity\Node;

$bundles = [
__BUNDLE_LIST__
];

$results = [];
$failed = false;

foreach ($bundles as $bundle) {
    $title = sprintf('API schema fixture %s %s', $bundle, substr(hash('sha256', microtime(true) . $bundle . random_int(1, PHP_INT_MAX)), 0, 8));

    try {
        $node = Node::create([
            'type' => $bundle,
            'title' => $title,
            'status' => FALSE,
        ]);
        $node->save();

        $results[] = [
            'bundle' => $bundle,
            'nid' => (int) $node->id(),
            'uuid' => $node->uuid(),
            'title' => $title,
            'jsonapi_type' => 'node--' . $bundle,
            'collection_path' => '/jsonapi/node/' . $bundle,
            'entity_path' => '/jsonapi/node/' . $bundle . '/' . $node->uuid(),
        ];
    }
    catch (Throwable $exception) {
        $failed = true;
        $results[] = [
            'bundle' => $bundle,
            'status' => 'error',
            'message' => $exception->getMessage(),
        ];
    }
}

print json_encode([
    'failed' => $failed,
    'results' => $results,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

if ($failed) {
  throw new RuntimeException('Fixture creation failed.');
}
'@.Replace('__BUNDLE_LIST__', $bundleList)
}

function New-DrXApiFixtureCleanupPhp {
  param([int[]]$Nids)

  $nidList = ($Nids | ForEach-Object { "    {0}" -f $_ }) -join ",`n"

  @'
<?php

use Drupal\node\Entity\Node;

$nids = [
__NID_LIST__
];

foreach ($nids as $nid) {
  $node = Node::load($nid);
  if ($node) {
    $node->delete();
  }
}
'@.Replace('__NID_LIST__', $nidList)
}

function Invoke-DrXInternalApiSchemaValidation {
  param(
    [string]$SchemaPath = $null,
    [string]$ComposeService = 'backend',
    [string]$EnvFile
  )

  $schemaBundles = @(Get-DrXSchemaBundles -SchemaPath $SchemaPath)
  if ($schemaBundles.Count -eq 0) {
    throw 'No bundles were found in the schema directory.'
  }

  $fixtureJson = Invoke-DrXDrushPhpScript -PhpContents (New-DrXApiSchemaFixturePhp -Bundles $schemaBundles) -ComposeService $ComposeService -ContainerPhpPath '/tmp/api-schema-fixtures.php'
  $fixturePayload = $fixtureJson | ConvertFrom-Json
  if ($fixturePayload.failed) {
    throw 'Fixture creation failed for API validation.'
  }

  $connection = Connect-DrXBackend -EnvFile $EnvFile
  $jsonApiIndex = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)/jsonapi" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
  $availableLinks = @($jsonApiIndex.links.PSObject.Properties.Name)

  $results = [System.Collections.ArrayList]::new()
  $remainingFixtureNids = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($fixture in @($fixturePayload.results)) {
    [void]$remainingFixtureNids.Add([int]$fixture.nid)
  }

  try {
    foreach ($fixture in @($fixturePayload.results)) {
      $fixtureStatusProperty = $fixture.PSObject.Properties['status']
      if ($null -ne $fixtureStatusProperty -and $fixtureStatusProperty.Value -eq 'error') {
        throw "Fixture creation failed for bundle $($fixture.bundle): $($fixture.message)"
      }

      $jsonApiType = "node--$($fixture.bundle)"
      if ($availableLinks -notcontains $jsonApiType) {
        throw "JSON:API index is missing link $jsonApiType"
      }

      $entity = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)$($fixture.entity_path)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
      if ($entity.data.attributes.title -ne $fixture.title) {
        throw "Bundle $($fixture.bundle) returned unexpected title from JSON:API."
      }

      $updatedTitle = "$($fixture.title) updated via api"
      $patchBody = @{
        data = @{
          type = $jsonApiType
          id = $fixture.uuid
          attributes = @{
            title = $updatedTitle
          }
        }
      }

      Invoke-DrXDrupalRequest -Method 'PATCH' -Uri "$($connection.BaseUrl)$($fixture.entity_path)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $connection.CsrfToken } -ContentType 'application/vnd.api+json' -Body $patchBody | Out-Null

      $reloaded = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)$($fixture.entity_path)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
      if ($reloaded.data.attributes.title -ne $updatedTitle) {
        throw "Bundle $($fixture.bundle) did not persist JSON:API PATCH title update."
      }

      Invoke-DrXDrupalRequest -Method 'DELETE' -Uri "$($connection.BaseUrl)$($fixture.entity_path)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $connection.CsrfToken } | Out-Null

      [void]$remainingFixtureNids.Remove([int]$fixture.nid)
      [void]$results.Add([pscustomobject]@{
        Bundle = $fixture.bundle
        EntityPath = $fixture.entity_path
        Status = 'ok'
      })
    }
  }
  finally {
    if ($remainingFixtureNids.Count -gt 0) {
      Invoke-DrXDrushPhpScript -PhpContents (New-DrXApiFixtureCleanupPhp -Nids @($remainingFixtureNids)) -ComposeService $ComposeService -ContainerPhpPath '/tmp/api-schema-cleanup.php' | Out-Null
    }
  }

  return [pscustomobject]@{
    BackendUrl = $connection.BaseUrl
    Results = @($results)
  }
}

function New-DrXExternalApiScalarValue {
  param(
    [hashtable]$Field,
    [string]$BundleName,
    [int]$Seed = 0
  )

  if ($Field['has_default']) {
    $value = $Field['default']
  } else {
    $type = ([string]$Field['type']).ToLowerInvariant()
    $key = [string]$Field['key']

    switch ($type) {
      'boolean' { $value = $false; break }
      'date' { $value = '2026-05-06'; break }
      'email' { $value = ('{0}-{1}@example.test' -f $BundleName, $Seed); break }
      'phone' { $value = ('555-010{0}' -f ($Seed % 10)); break }
      'radio' {
        if ($Field['options']) { $value = @($Field['options'])[0] } else { $value = ('option-{0}' -f $Seed) }
        break
      }
      'select' {
        if ($Field['options']) { $value = @($Field['options'])[0] } else { $value = ('option-{0}' -f $Seed) }
        break
      }
      'typed_contact_list' { $value = ('primary:{0}-{1}@example.test' -f $BundleName, $Seed); break }
      default { $value = ('{0} {1} {2}' -f $BundleName, $key, $Seed).Trim() }
    }
  }

  $cardinality = if ($Field.Contains('cardinality')) { [int]$Field['cardinality'] } else { 1 }
  if ($cardinality -ne 1) {
    return @($value)
  }

  return $value
}

function Remove-DrXExternalApiFixtures {
  param(
    [object[]]$CreatedNodes,
    [Parameter(Mandatory)]
    [psobject]$Connection
  )

  for ($index = $CreatedNodes.Count - 1; $index -ge 0; $index -= 1) {
    $node = $CreatedNodes[$index]
    if ($node.Deleted) {
      continue
    }

    try {
      Invoke-DrXDrupalRequest -Method 'DELETE' -Uri "$($Connection.BaseUrl)$($node.EntityPath)" -Session $Connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $Connection.CsrfToken } | Out-Null
      $node.Deleted = $true
    } catch {
    }
  }
}

function New-DrXExternalApiNodeFixture {
  param(
    [Parameter(Mandatory)]
    [hashtable]$Bundle,
    [Parameter(Mandatory)]
    [hashtable]$BundleMap,
    [Parameter(Mandatory)]
    [psobject]$Connection,
    [Parameter(Mandatory)]
    [object]$CreatedNodes,
    [int]$Seed = 0
  )

  $bundleName = [string]$Bundle['machine_name']
  $fieldEntries = @(Get-DrXBundleFieldEntries -Bundle $Bundle -BundleMap $BundleMap)
  $attributes = [ordered]@{
    title = ('External API fixture {0} {1}' -f $bundleName, $Seed)
    status = $false
  }
  $relationships = [ordered]@{}

  foreach ($entry in $fieldEntries) {
    $field = $entry['field']
    $fieldName = Get-DrXFieldName ($field['key'])
    $mapping = Get-DrXFieldMapping -Field $field
    $isRequired = [bool]$field['required']
    $hasDefault = [bool]$field['has_default']

    if (-not $isRequired -and -not $hasDefault) {
      continue
    }

    if ($mapping['storageType'] -eq 'entity_reference') {
      $targetBundleName = $null

      switch (([string]$field['type']).ToLowerInvariant()) {
        'address_reference' { $targetBundleName = 'address' }
        'person_reference' { $targetBundleName = 'person' }
        'student_reference' { $targetBundleName = 'student' }
        'node_reference' {
          if ($field['target_bundles'] -and @($field['target_bundles']).Count -gt 0) {
            $targetBundleName = ConvertTo-DrXBundleName (@($field['target_bundles'])[0])
          }
        }
      }

      if (-not $targetBundleName) {
        throw "Field $fieldName on bundle $bundleName is a required reference with no target bundle."
      }

      if (-not $BundleMap.ContainsKey($targetBundleName)) {
        throw "Bundle $bundleName references missing target bundle $targetBundleName."
      }

      $targetFixture = New-DrXExternalApiNodeFixture -Bundle $BundleMap[$targetBundleName] -BundleMap $BundleMap -Connection $Connection -CreatedNodes $CreatedNodes -Seed ($Seed + 1)
      $resourceIdentifier = [ordered]@{
        type = "node--$targetBundleName"
        id = $targetFixture.Uuid
      }

      $cardinality = if ($field.Contains('cardinality')) { [int]$field['cardinality'] } else { 1 }
      $relationships[$fieldName] = [ordered]@{
        data = $(if ($cardinality -ne 1) { @($resourceIdentifier) } else { $resourceIdentifier })
      }
      continue
    }

    $attributes[$fieldName] = New-DrXExternalApiScalarValue -Field $field -BundleName $bundleName -Seed $Seed
  }

  $payloadData = [ordered]@{
    type = "node--$bundleName"
    attributes = $attributes
  }

  if ($relationships.Count -gt 0) {
    $payloadData['relationships'] = $relationships
  }

  $response = Invoke-DrXDrupalRequest -Method 'POST' -Uri "$($Connection.BaseUrl)/jsonapi/node/$bundleName" -Session $Connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $Connection.CsrfToken } -ContentType 'application/vnd.api+json' -Body @{ data = $payloadData }
  $fixture = [ordered]@{
    Bundle = $bundleName
    Uuid = [string]$response.data.id
    EntityPath = "/jsonapi/node/$bundleName/$($response.data.id)"
    Title = [string]$attributes['title']
    Deleted = $false
  }
  [void]$CreatedNodes.Add($fixture)
  return $fixture
}

function Invoke-DrXExternalApiSchemaValidation {
  param(
    [string]$SchemaPath = $null,
    [string]$EnvFile
  )

  $normalizedSchema = ConvertTo-DrXNormalizedSchema -ParsedSchema (Import-DrXSchema -SchemaPath $SchemaPath)
  $bundles = @($normalizedSchema['bundles'])
  if ($bundles.Count -eq 0) {
    throw 'No bundles were found in the schema directory.'
  }

  $bundleMap = @{}
  foreach ($bundle in $bundles) {
    $bundleMap[[string]$bundle['machine_name']] = $bundle
  }

  $connection = Connect-DrXBackend -EnvFile $EnvFile
  $jsonApiIndex = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)/jsonapi" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
  $availableLinks = @($jsonApiIndex.links.PSObject.Properties.Name)
  $results = [System.Collections.ArrayList]::new()
  $failed = $false

  for ($index = 0; $index -lt $bundles.Count; $index += 1) {
    $bundle = $bundles[$index]
    $bundleName = [string]$bundle['machine_name']
    $createdNodes = [System.Collections.ArrayList]::new()

    try {
      $fixture = New-DrXExternalApiNodeFixture -Bundle $bundle -BundleMap $bundleMap -Connection $connection -CreatedNodes $createdNodes -Seed $index
      $jsonApiType = "node--$bundleName"
      if ($availableLinks -notcontains $jsonApiType) {
        throw "JSON:API index is missing link $jsonApiType"
      }

      $entity = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)$($fixture.EntityPath)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
      if ($entity.data.attributes.title -ne $fixture.Title) {
        throw "Bundle $bundleName returned unexpected title from JSON:API."
      }

      $updatedTitle = "$($fixture.Title) updated via external api"
      $patchBody = @{
        data = @{
          type = $jsonApiType
          id = $fixture.Uuid
          attributes = @{
            title = $updatedTitle
          }
        }
      }

      Invoke-DrXDrupalRequest -Method 'PATCH' -Uri "$($connection.BaseUrl)$($fixture.EntityPath)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $connection.CsrfToken } -ContentType 'application/vnd.api+json' -Body $patchBody | Out-Null

      $reloaded = Invoke-DrXDrupalRequest -Method 'GET' -Uri "$($connection.BaseUrl)$($fixture.EntityPath)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json' }
      if ($reloaded.data.attributes.title -ne $updatedTitle) {
        throw "Bundle $bundleName did not persist JSON:API PATCH title update."
      }

      Invoke-DrXDrupalRequest -Method 'DELETE' -Uri "$($connection.BaseUrl)$($fixture.EntityPath)" -Session $connection.Session -Headers @{ Accept = 'application/vnd.api+json'; 'X-CSRF-Token' = $connection.CsrfToken } | Out-Null
      $fixture.Deleted = $true

      [void]$results.Add([pscustomobject]@{
        Bundle = $bundleName
        EntityPath = $fixture.EntityPath
        Status = 'ok'
      })
    }
    catch {
      $failed = $true
      [void]$results.Add([pscustomobject]@{
        Bundle = $bundleName
        EntityPath = ''
        Status = 'error'
        Message = $_.Exception.Message
      })
    }
    finally {
      Remove-DrXExternalApiFixtures -CreatedNodes @($createdNodes) -Connection $connection
    }
  }

  if ($failed) {
    $failures = @($results | Where-Object { $_.Status -eq 'error' } | ForEach-Object { '{0}: {1}' -f $_.Bundle, $_.Message })
    throw ('External API schema validation failed: ' + ($failures -join '; '))
  }

  return [pscustomobject]@{
    BackendUrl = $connection.BaseUrl
    Results = @($results)
  }
}

function Invoke-DrXSchemaCrudValidation {
  param(
    [string]$SchemaPath = $null,
    [string]$ComposeService = 'backend'
  )

  return Invoke-DrXDbSchemaValidation -SchemaPath $SchemaPath -ComposeService $ComposeService
}

function Invoke-DrXApiSchemaValidation {
  param(
    [string]$SchemaPath = $null,
    [string]$ComposeService = 'backend',
    [string]$EnvFile
  )

  return Invoke-DrXInternalApiSchemaValidation -SchemaPath $SchemaPath -ComposeService $ComposeService -EnvFile $EnvFile
}

Export-ModuleMember -Function @(
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