$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$localRuby = Join-Path $PSScriptRoot '.local/ruby/bin'
if (Test-Path $localRuby) {
    $env:Path = "$localRuby;$env:Path"
}
if (-not (Get-Command ruby -ErrorAction SilentlyContinue)) {
    throw 'Install Ruby+Devkit from https://rubyinstaller.org/downloads/ and reopen PowerShell.'
}
$env:BUNDLE_PATH = Join-Path $PSScriptRoot '.local/gems'
bundle check
if ($LASTEXITCODE -ne 0) {
    bundle install
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
bundle exec jekyll serve --host 127.0.0.1 --port 4000 --force_polling --config _config.yml,_config.local.yml
