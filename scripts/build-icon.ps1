$ErrorActionPreference = 'Stop'
$builder = Join-Path $PSScriptRoot 'build-app-icon.js'
& node $builder
if ($LASTEXITCODE -ne 0) { throw 'Unable to build Cherry app icon.' }
