[CmdletBinding()]
param(
  [string]$EnvFile = ".env.local-test",
  [string]$ProjectName = "nju-match-local"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$appRoot = Join-Path $repoRoot "NJU-Date-basic"
$resolvedEnv = Join-Path $appRoot $EnvFile

if (-not (Test-Path $resolvedEnv)) {
  throw "Missing $resolvedEnv. Copy .env.local-test.example and keep the result untracked."
}
$dockerOs = docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dockerOs.Trim() -ne "linux") {
  throw "Docker Desktop must be running in Linux container mode."
}

Push-Location $appRoot
try {
  docker compose --project-name $ProjectName --env-file $resolvedEnv -f docker-compose.yml -f docker-compose.local-test.yml up --detach --build --remove-orphans
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  docker compose --project-name $ProjectName --env-file $resolvedEnv -f docker-compose.yml -f docker-compose.local-test.yml ps
  Write-Host "NJU Match is starting at http://127.0.0.1:8082"
} finally {
  Pop-Location
}
