param(
    [string]$Config = 'configs/cluster_lab/overnight.yaml',
    [string]$Python = 'python',
    [string]$Output = 'warehouse/cluster_lab'
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$outputPath = [IO.Path]::GetFullPath((Join-Path $repoRoot $Output))
New-Item -ItemType Directory -Force -Path (Join-Path $outputPath 'logs') | Out-Null
if (Test-Path -LiteralPath (Join-Path $outputPath 'STOP')) {
    throw 'STOP is present. Remove it after verifying the previous process exited, then resume.'
}
$env:PYTHONUTF8 = '1'
$env:PYTHONUNBUFFERED = '1'
$pythonPath = (Get-Command $Python).Source
& $pythonPath -m ml.cluster_lab.cli validate --config $Config
if ($LASTEXITCODE -ne 0) { throw 'Configuration validation failed' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $outputPath "logs/overnight-$stamp.log"
$errorLog = Join-Path $outputPath "logs/overnight-$stamp.err.log"
$worker = Start-Process -FilePath $pythonPath -ArgumentList @('-u','-m','ml.cluster_lab.cli','run','--config',$Config,'--resume') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru
@{ pid = $worker.Id; config = $Config; stdout = $log; stderr = $errorLog; started_at = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputPath 'session.json') -Encoding UTF8
Start-Sleep -Seconds 2
$live = Get-Process -Id $worker.Id -ErrorAction SilentlyContinue
if (-not $live) { Get-Content -LiteralPath $errorLog; throw 'Worker exited; inspect the logs' }
Write-Output "Cluster Lab PID $($worker.Id)"
Write-Output "Log: $log"
Write-Output "Errors: $errorLog"
