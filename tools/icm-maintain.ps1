#!/usr/bin/env pwsh
param(
    [ValidateSet("quick","full","schedule","validate","prune")]
    [string]$Mode = "quick",
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProjectName = Split-Path -Leaf $ProjectRoot
Push-Location $ProjectRoot

function Invoke-Icm {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$IcmArgs)
    & icm.exe @IcmArgs 2>&1
}

function Write-IcmAudit {
    param(
        [string]$Action,
        [string]$Details
    )
    $date = Get-Date -Format "yyyy-MM-dd"
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ssK"
    $content = "[$stamp][$ProjectName][$Action] $Details"
    Invoke-Icm store --topic icm-audit --content $content --importance critical --keywords "icm-audit,source=icm-maintain,date=$date,ttl=90,importance=critical"
}

function New-IcmSnapshot {
    $snapshotDir = Join-Path $ProjectRoot "snapshots"
    if (-not (Test-Path $snapshotDir)) {
        New-Item -ItemType Directory -Path $snapshotDir -Force | Out-Null
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outFile = Join-Path $snapshotDir "icm-snapshot-$stamp.txt"
    "ICM snapshot for $ProjectName at $(Get-Date -Format o)" | Set-Content -Path $outFile -Encoding UTF8
    "" | Add-Content -Path $outFile -Encoding UTF8
    Invoke-Icm list --all --sort created | Add-Content -Path $outFile -Encoding UTF8
    Write-IcmAudit -Action "snapshot" -Details "Created pre-prune snapshot: $outFile"
    return $outFile
}

try {
    switch ($Mode) {
        "quick" {
            Write-Host "[ICM] Quick maintain: extract-pending + embed" -ForegroundColor Cyan
            Invoke-Icm extract-pending --limit 20 --no-embeddings
            Invoke-Icm embed
        }
        "full" {
            Write-Host "[ICM] Full maintain: extract + embed + decay + prune + consolidate" -ForegroundColor Cyan
            Invoke-Icm extract-pending --limit 50 --no-embeddings
            Invoke-Icm embed
            Invoke-Icm decay
            New-IcmSnapshot | Out-Null
            Write-IcmAudit -Action "prune" -Details "Full maintenance is running icm prune after snapshot."
            Invoke-Icm prune
            Invoke-Icm consolidate --all
        }
        "schedule" {
            Write-Host "[ICM] Schedule check: quick maintain + health" -ForegroundColor Cyan
            Invoke-Icm extract-pending --limit 20 --no-embeddings
            Invoke-Icm embed
            Invoke-Icm health
            Write-Host "[ICM] Weekly validate: tools\icm-maintain.ps1 -Mode validate" -ForegroundColor Yellow
            Write-Host "[ICM] Monthly prune: tools\icm-maintain.ps1 -Mode prune" -ForegroundColor Yellow
        }
        "validate" {
            Write-Host "[ICM] Validate: health report + review cues" -ForegroundColor Cyan
            Invoke-Icm health
            Write-Host "" 
            Write-Host "[ICM] Review TTL metadata in keywords: source=..., date=YYYY-MM-DD, ttl=days, importance=low|normal|critical" -ForegroundColor Yellow
            Write-Host "[ICM] Mark entries expiring within 30 days as review=true; notify topic owner." -ForegroundColor Yellow
            Write-Host "[ICM] Propose archive/delete for low-importance entries unused for 180 days." -ForegroundColor Yellow
            Write-Host "[ICM] Confirm critical memories every 90 days." -ForegroundColor Yellow
            Write-Host "" 
            Invoke-Icm list --all --sort accessed
            Write-IcmAudit -Action "validate" -Details "Validation completed; reviewed health and access order."
        }
        "prune" {
            Write-Host "[ICM] Prune: snapshot first, then prune low-weight memories" -ForegroundColor Cyan
            $snapshot = New-IcmSnapshot
            if ($DryRun) {
                Write-IcmAudit -Action "prune-dry-run" -Details "Dry-run prune after snapshot: $snapshot"
                Invoke-Icm prune --dry-run
            } else {
                Write-IcmAudit -Action "prune" -Details "Monthly prune after snapshot: $snapshot"
                Invoke-Icm prune
            }
        }
    }
}
finally {
    Pop-Location
}
