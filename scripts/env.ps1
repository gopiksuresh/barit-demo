# Dot-source this in each new PowerShell window before working on BARit:
#   . .\scripts\env.ps1
# Puts the portable Node 22 + PostgreSQL 16 (in %LOCALAPPDATA%\BARit-tools) ahead of
# the system Node 16 for this session only. Nothing global is changed.
$T = Join-Path $env:LOCALAPPDATA 'BARit-tools'
$env:Path = "$T\node;$T\pgsql\bin;$env:Path"
$env:PGDATA = "$T\pgdata"
Write-Host "BARit env: node $(node -v), $(postgres --version)"

function Start-BaritDb { pg_ctl -D $env:PGDATA -l "$T\pgdata.log" -o "-p 5432" start }
function Stop-BaritDb  { pg_ctl -D $env:PGDATA stop }
Write-Host "Helpers: Start-BaritDb / Stop-BaritDb"
