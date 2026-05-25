#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
    [string]$TargetDir,
    [string]$ProjectName
)

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$TemplateDir = Split-Path -Parent $PSScriptRoot

$FilesToCopy = @(
    ".gitignore",
    "SYSTEM_CONTEXT.md",
    "ARCHITECTURE_MAP.md",
    "DECISIONS.md",
    "TODO_STATE.md",
    "AI_RULES.md",
    "README.md"
)

$DirsToCopy = @(
    ".opencode",
    ".githooks",
    "tools"
)

Write-Host "[TEMPLATE] Initializing project..." -ForegroundColor Cyan

foreach ($file in $FilesToCopy) {
    $src = Join-Path $TemplateDir $file
    $dst = Join-Path $TargetDir $file
    if (Test-Path $src -and $file -ne "README.md") {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied: $file" -ForegroundColor Green
    }
}

foreach ($dir in $DirsToCopy) {
    $src = Join-Path $TemplateDir $dir
    $dst = Join-Path $TargetDir $dir
    if (-not (Test-Path $dst)) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
        Write-Host "  Copied: $dir/" -ForegroundColor Green
    }
}

$SrcDir = Join-Path $TargetDir "src"
if (-not (Test-Path $SrcDir)) {
    New-Item -ItemType Directory -Path $SrcDir -Force | Out-Null
    New-Item -ItemType File -Path (Join-Path $SrcDir ".gitkeep") -Force | Out-Null
    Write-Host "  Created: src/" -ForegroundColor Green
}

if ($ProjectName) {
    $ReadmePath = Join-Path $TargetDir "README.md"
    "# $ProjectName`n`nInitialized from template." | Set-Content -Path $ReadmePath -Force
    Write-Host "  Created: README.md" -ForegroundColor Green
}

Push-Location $TargetDir
if (-not (Test-Path ".git")) {
    git init 2>&1 | Out-Null
    git add -A 2>&1 | Out-Null
    git commit -m "Initial commit" 2>&1 | Out-Null
    Write-Host "  git: initialized" -ForegroundColor Green
}
git config core.hooksPath .githooks 2>&1 | Out-Null
Write-Host "  git hooks: activated" -ForegroundColor Green
Pop-Location

Write-Host ""
Write-Host "[TEMPLATE] Done. Project initialized at: $TargetDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Put your prototype in src/" -ForegroundColor White
Write-Host "  2. Ask AI: 'Fill .md files based on src/ code'" -ForegroundColor White
Write-Host "  3. Run: icm init --mode hook --force" -ForegroundColor White
Write-Host "  4. Run: icm store --topic architecture --content 'Project initialized' --importance high" -ForegroundColor White
Write-Host "  5. Run: icm embed" -ForegroundColor White
