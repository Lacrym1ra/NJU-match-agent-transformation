[CmdletBinding()]
param(
  [string]$Tag = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$packageRoot = Join-Path $repoRoot "deployment-packages"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required. Install it and enable Linux containers."
}
$dockerOs = docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dockerOs.Trim() -ne "linux") {
  throw "Docker Desktop must be running in Linux container mode."
}

$commit = (git -C $repoRoot rev-parse --short=12 HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve the Git commit." }
$dirty = git -C $repoRoot status --porcelain --untracked-files=no
if ($dirty) {
  throw "Tracked files are dirty. Commit the tested source before exporting deployment artifacts."
}
if ([string]::IsNullOrWhiteSpace($Tag)) { $Tag = $commit }
$safeTag = $Tag -replace '[^A-Za-z0-9_.-]', '-'

New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

& (Join-Path $PSScriptRoot "build-images.ps1") -Tag $safeTag
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$backendImage = "nju-match-backend:$safeTag"
$frontendImage = "nju-match-frontend:$safeTag"
$postgresImage = "postgres:16-alpine"
$postgresPlatform = docker image inspect $postgresImage --format '{{.Os}}/{{.Architecture}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $postgresPlatform.Trim() -ne 'linux/amd64') {
  docker pull --platform linux/amd64 $postgresImage
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$archiveBase = "nju-match-images-$safeTag-linux-amd64"
$tarPath = Join-Path $packageRoot "$archiveBase.tar"
$gzipPath = "$tarPath.gz"
$sourcePath = Join-Path $packageRoot "nju-match-source-$safeTag.zip"
$checksumPath = Join-Path $packageRoot "$archiveBase.sha256"
$manifestPath = Join-Path $packageRoot "nju-match-deployment-$safeTag.json"

foreach ($path in @($tarPath, $gzipPath, $sourcePath, $checksumPath, $manifestPath)) {
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}

docker image save --output $tarPath $backendImage $frontendImage $postgresImage
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$inputStream = [System.IO.File]::OpenRead($tarPath)
$outputStream = [System.IO.File]::Create($gzipPath)
$gzipStream = [System.IO.Compression.GZipStream]::new(
  $outputStream,
  [System.IO.Compression.CompressionLevel]::Optimal
)
try {
  $inputStream.CopyTo($gzipStream)
} finally {
  $gzipStream.Dispose()
  $inputStream.Dispose()
  $outputStream.Dispose()
}
Remove-Item -LiteralPath $tarPath -Force

git -C $repoRoot archive --format=zip --output=$sourcePath HEAD
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$imageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $gzipPath).Hash.ToLowerInvariant()
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant()
@(
  "$imageHash  $([System.IO.Path]::GetFileName($gzipPath))",
  "$sourceHash  $([System.IO.Path]::GetFileName($sourcePath))"
) | Set-Content -Encoding ascii -LiteralPath $checksumPath

$manifest = [ordered]@{
  generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
  commit = $commit
  platform = 'linux/amd64'
  sourceArchive = [System.IO.Path]::GetFileName($sourcePath)
  imageArchive = [System.IO.Path]::GetFileName($gzipPath)
  images = [ordered]@{
    backend = [ordered]@{ tag = $backendImage; id = (docker image inspect $backendImage --format '{{.Id}}') }
    frontend = [ordered]@{ tag = $frontendImage; id = (docker image inspect $frontendImage --format '{{.Id}}') }
    postgres = [ordered]@{ tag = $postgresImage; id = (docker image inspect $postgresImage --format '{{.Id}}') }
  }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath $manifestPath

Write-Host "Deployment package created in $packageRoot"
Write-Host "  $gzipPath"
Write-Host "  $sourcePath"
Write-Host "  $checksumPath"
Write-Host "  $manifestPath"
