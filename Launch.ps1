$ErrorActionPreference = 'Stop'
$tabsApp = Join-Path $PSScriptRoot 'app\ChatGPT.exe'
if (-not (Test-Path -LiteralPath $tabsApp)) {
    throw 'Build the local application copy first. See README.md.'
}
Start-Process -FilePath $tabsApp -WorkingDirectory (Split-Path -Parent $tabsApp) -WindowStyle Normal
