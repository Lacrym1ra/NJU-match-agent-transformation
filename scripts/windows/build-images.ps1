[CmdletBinding()]
param(
  [string]$Tag = "local"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required. Install it and enable Linux containers."
}
$dockerOs = docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dockerOs.Trim() -ne "linux") {
  throw "Docker Desktop must be running in Linux container mode."
}

docker build --file "$repoRoot\NJU-Date-basic\backend\Dockerfile" --tag "nju-match-backend:$Tag" "$repoRoot"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker build --file "$repoRoot\NJU-Date-basic\frontend\Dockerfile" --tag "nju-match-frontend:$Tag" "$repoRoot\NJU-Date-basic\frontend"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Built nju-match-backend:$Tag and nju-match-frontend:$Tag"
