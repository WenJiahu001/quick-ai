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
    $firefoxDirectory = Join-Path $repositoryRoot "dist\firefox"
    $chromiumManifest = Get-Content (Join-Path $chromiumDirectory "manifest.json") -Raw | ConvertFrom-Json
    $firefoxManifest = Get-Content (Join-Path $firefoxDirectory "manifest.json") -Raw | ConvertFrom-Json

    if ($chromiumManifest.version -ne $firefoxManifest.version) {
        throw "Chromium 与 Firefox 清单的版本号必须一致。"
    }

    $minimumFirefoxVersion = [Version]$firefoxManifest.browser_specific_settings.gecko.strict_min_version
    if ($minimumFirefoxVersion -lt [Version]"140.0") {
        throw "Firefox 发布版最低版本必须为 140.0，以使用内置数据传输同意机制。"
    }

    $version = $chromiumManifest.version
    $releaseDirectory = Join-Path $repositoryRoot "dist\releases"
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

    $chromiumArchive = Join-Path $releaseDirectory "quick-ai-chromium-v$version.zip"
    $firefoxUploadArchive = Join-Path $releaseDirectory "quick-ai-firefox-upload-v$version.zip"
    Compress-Archive -Path (Join-Path $chromiumDirectory "*") -DestinationPath $chromiumArchive -CompressionLevel Optimal -Force
    Compress-Archive -Path (Join-Path $firefoxDirectory "*") -DestinationPath $firefoxUploadArchive -CompressionLevel Optimal -Force

    Write-Output "Chromium 发布包：$chromiumArchive"
    Write-Output "Firefox 提交 AMO 签名用包：$firefoxUploadArchive"
    Write-Output "Firefox ZIP 仅用于 AMO 签名；GitHub Release 应发布 AMO 返回的签名 XPI。"
}
finally {
    Pop-Location
}
