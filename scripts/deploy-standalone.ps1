<#
.SYNOPSIS
    Builds the HRMS standalone package, backs up existing deployment, and copies new build to the target directory.

.DESCRIPTION
    1. Runs 'npm run build:standalone'
    2. Backs up existing deployment in 'C:\SigmaToolbox\Frontend\HRMS' to 'C:\SigmaToolbox\Frontend\HRMS_Backups' as a timestamped .zip
    3. Copies content from 'hrms-standalone-build' to 'C:\SigmaToolbox\Frontend\HRMS'

.PARAMETER Destination
    Target directory for deployment (Default: "C:\SigmaToolbox\Frontend\HRMS").

.PARAMETER BackupDir
    Target directory for backup zip files (Default: "C:\SigmaToolbox\Frontend\HRMS_Backups").

.PARAMETER SkipBuild
    Skip running the build step and only perform backup and copy operations.

.PARAMETER SkipBackup
    Skip backing up the existing deployment folder.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/deploy-standalone.ps1
    powershell -ExecutionPolicy Bypass -File scripts/deploy-standalone.ps1 -Destination "C:\SigmaToolbox\Frontend\HRMS"
    powershell -ExecutionPolicy Bypass -File scripts/deploy-standalone.ps1 -SkipBuild
#>

[CmdletBinding()]
param (
    [string]$Destination = "C:\SigmaToolbox\Frontend\HRMS",
    [string]$BackupDir = "C:\SigmaToolbox\Frontend\HRMS_Backups",
    [switch]$SkipBuild,
    [switch]$SkipBackup
)

# Ensure System32 is in PATH for standard Windows utilities (cmd, robocopy, etc.)
$system32Path = [System.IO.Path]::Combine($env:SystemRoot, "System32")
if ($env:PATH -notlike "*$system32Path*") {
    $env:PATH = "$system32Path;$env:PATH"
}

$ErrorActionPreference = "Stop"

# Determine project root directory (parent of scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    $ProjectRoot = (Get-Location).Path
}

$SourceDir = Join-Path $ProjectRoot "hrms-standalone-build"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   HRMS Standalone Build & Deploy Script" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Project Root : $ProjectRoot" -ForegroundColor Gray
Write-Host "Source Dir   : $SourceDir" -ForegroundColor Gray
Write-Host "Target Dir   : $Destination" -ForegroundColor Gray
Write-Host "Backup Dir   : $BackupDir" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Push-Location $ProjectRoot

try {
    # -------------------------------------------------------------
    # 1. BUILD STANDALONE
    # -------------------------------------------------------------
    if (-not $SkipBuild) {
        Write-Host "`n[1/3] Running 'npm run build:standalone'..." -ForegroundColor Yellow
        
        # Execute npm run build:standalone safely
        $npmItem = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $npmItem) {
            $npmItem = Get-Command npm -ErrorAction SilentlyContinue
        }

        if ($npmItem -and $npmItem.Source) {
            & $npmItem.Source run build:standalone
        } else {
            $comspec = if ($env:ComSpec -and (Test-Path $env:ComSpec)) { $env:ComSpec } else { "$env:SystemRoot\System32\cmd.exe" }
            & $comspec /c "npm run build:standalone"
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "`n[ERROR] Build failed with exit code $LASTEXITCODE. Aborting deployment." -ForegroundColor Red
            exit $LASTEXITCODE
        }
        
        Write-Host "`n[SUCCESS] Build completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n[1/3] Skipping build step (-SkipBuild flag specified)..." -ForegroundColor Yellow
    }

    # -------------------------------------------------------------
    # 2. VALIDATE SOURCE BUILD
    # -------------------------------------------------------------
    if (-not (Test-Path $SourceDir)) {
        Write-Host "`n[ERROR] Source folder '$SourceDir' not found!" -ForegroundColor Red
        Write-Host "Please ensure the build completed or run without -SkipBuild." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # 3. BACKUP EXISTING DEPLOYMENT (ZIP FORMAT)
    # -------------------------------------------------------------
    if (-not $SkipBackup) {
        if (Test-Path $Destination) {
            $existingItems = Get-ChildItem -Path $Destination -Force
            if ($existingItems -and $existingItems.Count -gt 0) {
                if (-not (Test-Path $BackupDir)) {
                    Write-Host "`nCreating backup directory '$BackupDir'..." -ForegroundColor Cyan
                    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
                }

                $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
                $zipFileName = "HRMS_backup_$timestamp.zip"
                $zipFilePath = Join-Path $BackupDir $zipFileName

                Write-Host "`n[2/3] Backing up existing HRMS deployment to:" -ForegroundColor Yellow
                Write-Host "      $zipFilePath" -ForegroundColor Cyan
                
                # Compress all existing contents into timestamped .zip
                $itemsToZip = Get-ChildItem -Path $Destination -Force | Select-Object -ExpandProperty FullName
                Compress-Archive -Path $itemsToZip -DestinationPath $zipFilePath -CompressionLevel Optimal -Force
                
                $zipSizeMb = [math]::Round(((Get-Item $zipFilePath).Length / 1MB), 2)
                Write-Host "[SUCCESS] Backup created successfully ($zipSizeMb MB)" -ForegroundColor Green
            } else {
                Write-Host "`n[2/3] Target directory is empty. No backup needed." -ForegroundColor Gray
            }
        } else {
            Write-Host "`n[2/3] Target directory '$Destination' does not exist yet. Skipping backup." -ForegroundColor Gray
        }
    } else {
        Write-Host "`n[2/3] Skipping backup step (-SkipBackup flag specified)..." -ForegroundColor Yellow
    }

    # -------------------------------------------------------------
    # 4. ENSURE DESTINATION DIRECTORY EXISTS
    # -------------------------------------------------------------
    if (-not (Test-Path $Destination)) {
        Write-Host "`nTarget directory '$Destination' does not exist. Creating directory..." -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }

    # -------------------------------------------------------------
    # 5. COPY CONTENT TO DESTINATION
    # -------------------------------------------------------------
    Write-Host "`n[3/3] Copying build contents from '$SourceDir' to '$Destination'..." -ForegroundColor Yellow
    
    # Use Robocopy if available for fast, reliable recursive file copying on Windows
    # Robocopy exit codes 0-7 indicate success
    $roboItem = Get-Command robocopy.exe -ErrorAction SilentlyContinue
    if (-not $roboItem) {
        $roboItem = Get-Command robocopy -ErrorAction SilentlyContinue
    }

    if ($roboItem -and $roboItem.Source) {
        $robocopyArgs = @(
            "$SourceDir",
            "$Destination",
            "/E",          # Copy subdirectories, including empty ones
            "/R:3",        # Retry 3 times on locked files
            "/W:2",        # Wait 2 seconds between retries
            "/NP",         # No progress percentage clutter
            "/NDL",        # Don't log directory names
            "/NFL"         # Don't log file names
        )

        Write-Host "Syncing files using Robocopy..." -ForegroundColor Gray
        & $roboItem.Source @robocopyArgs | Out-Null
        $roboExit = $LASTEXITCODE

        if ($roboExit -ge 8) {
            Write-Host "[WARNING] Robocopy returned exit code $roboExit. Falling back to PowerShell Copy-Item..." -ForegroundColor Yellow
            Copy-Item -Path "$SourceDir\*" -Destination $Destination -Recurse -Force
            Write-Host "[SUCCESS] Copy-Item completed successfully." -ForegroundColor Green
        } else {
            Write-Host "[SUCCESS] Files copied successfully (Robocopy Code: $roboExit)." -ForegroundColor Green
        }
    } else {
        Write-Host "Syncing files using Copy-Item..." -ForegroundColor Gray
        Copy-Item -Path "$SourceDir\*" -Destination $Destination -Recurse -Force
        Write-Host "[SUCCESS] Copy-Item completed successfully." -ForegroundColor Green
    }

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT COMPLETE! Files copied to: $Destination" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
catch {
    $err = $_.Exception.Message
    Write-Host "`n[ERROR] Unexpected error: $err" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
