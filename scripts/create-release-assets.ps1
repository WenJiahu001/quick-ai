[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot

try {
    & node scripts/check.mjs
    if ($LASTEXITCODE -ne 0) { throw "静态检查失败，停止生成发布包。" }
    & node scripts/package.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "扩展打包失败，退出码：$LASTEXITCODE"
    }
    & node scripts/check.mjs --package
    if ($LASTEXITCODE -ne 0) { throw "安装目录与源码检查失败，停止生成发布包。" }

    $chromiumDirectory = Join-Path $repositoryRoot "dist\chromium"
    $chromiumManifest = Get-Content (Join-Path $chromiumDirectory "manifest.json") -Raw | ConvertFrom-Json

    $version = $chromiumManifest.version
    $releaseDirectory = Join-Path $repositoryRoot "dist\releases"
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

    $chromiumArchive = Join-Path $releaseDirectory "quick-ai-chromium-v$version.zip"
    Compress-Archive -Path (Join-Path $chromiumDirectory "*") -DestinationPath $chromiumArchive -CompressionLevel Optimal -Force
    $checksum = (Get-FileHash -LiteralPath $chromiumArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$chromiumArchive.sha256" -Value "$checksum  $(Split-Path -Leaf $chromiumArchive)" -Encoding ascii

    Write-Output "Chromium 发布包：$chromiumArchive"
    Write-Output "校验文件：$chromiumArchive.sha256"
}
finally {
    Pop-Location
}
