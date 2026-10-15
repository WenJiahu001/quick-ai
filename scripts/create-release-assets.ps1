[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot

try {
    & node scripts/package.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "扩展打包失败，退出码：$LASTEXITCODE"
    }

    $chromiumDirectory = Join-Path $repositoryRoot "dist\chromium"
    $chromiumManifest = Get-Content (Join-Path $chromiumDirectory "manifest.json") -Raw | ConvertFrom-Json

    $version = $chromiumManifest.version
    $releaseDirectory = Join-Path $repositoryRoot "dist\releases"
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

    $chromiumArchive = Join-Path $releaseDirectory "quick-ai-chromium-v$version.zip"
    Compress-Archive -Path (Join-Path $chromiumDirectory "*") -DestinationPath $chromiumArchive -CompressionLevel Optimal -Force

    Write-Output "Chromium 发布包：$chromiumArchive"
}
finally {
    Pop-Location
}
