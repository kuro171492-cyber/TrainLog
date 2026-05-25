#!/usr/bin/env pwsh
param(
    [ValidateSet("quick","full","schedule")]
    [string]$Mode = "quick"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot

switch ($Mode) {
    "quick" {
        Write-Host "[ICM] Quick maintain: extract-pending + embed" -ForegroundColor Cyan
        icm.exe extract-pending --limit 20 --no-embeddings 2>&1
        icm.exe embed 2>&1
    }
    "full" {
        Write-Host "[ICM] Full maintain: extract + embed + decay + prune + consolidate" -ForegroundColor Cyan
        icm.exe extract-pending --limit 50 --no-embeddings 2>&1
        icm.exe embed 2>&1
        icm.exe decay 2>&1
        icm.exe prune 2>&1
        icm.exe consolidate --all 2>&1
    }
    "schedule" {
        Write-Host "[ICM] Checking memory age for maintenance" -ForegroundColor Cyan
        icm.exe extract-pending --limit 20 --no-embeddings 2>&1
        icm.exe embed 2>&1
        $stats = icm.exe stats --format json 2>$null | ConvertFrom-Json
        if ($stats -and $stats.oldest_days -gt 7) {
            icm.exe decay 2>&1
            icm.exe prune 2>&1
        }
        if ($stats -and $stats.oldest_days -gt 14) {
            icm.exe consolidate --all 2>&1
        }
    }
}

Pop-Location
