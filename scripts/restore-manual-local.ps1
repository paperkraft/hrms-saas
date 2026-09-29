param (
    [string]$FilePath,
    [switch]$SkipResetPassword
)

# ==============================
# CONFIG
# ==============================

$LOCAL_BACKUP_DIR = "C:\Temp\db-backups"

$POSTGRES_HOST = "localhost"
$POSTGRES_PORT = "5432"
$POSTGRES_USER = "postgres"
$POSTGRES_PASSWORD = "sigma"

$DATABASE = "hrms"

$PG_RESTORE = "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe"
$PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# ==============================
# DETERMINE BACKUP FILE
# ==============================

$targetFile = $FilePath

if ([string]::IsNullOrWhiteSpace($targetFile)) {
    Write-Host "No FilePath specified. Searching for existing local backups in '$LOCAL_BACKUP_DIR'..." -ForegroundColor Cyan

    if (Test-Path $LOCAL_BACKUP_DIR) {
        $localBackups = Get-ChildItem -Path $LOCAL_BACKUP_DIR -File -Filter "*.backup" | Sort-Object LastWriteTime -Descending
        if (-not $localBackups -or $localBackups.Count -eq 0) {
            $localBackups = Get-ChildItem -Path $LOCAL_BACKUP_DIR -File | Sort-Object LastWriteTime -Descending
        }

        if ($localBackups -and $localBackups.Count -gt 0) {
            $targetFile = $localBackups[0].FullName
            Write-Host "Found most recent local backup: $($localBackups[0].Name)" -ForegroundColor Green
            Write-Host "Location: $targetFile"
        }
    }
}

if (-not $targetFile -or -not (Test-Path $targetFile)) {
    Write-Host "❌ Error: Backup file not found!" -ForegroundColor Red
    Write-Host "Usage:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/restore-manual-local.ps1"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/restore-manual-local.ps1 -FilePath `"C:\path\to\backup_file.backup`""
    exit 1
}

Write-Host "Selected backup file: $targetFile" -ForegroundColor Cyan

# ==============================
# RESET SCHEMA
# ==============================

Write-Host "`nResetting schema for clean restore..." -ForegroundColor Yellow

$env:PGPASSWORD = $POSTGRES_PASSWORD

& $PSQL -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $DATABASE -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

# ==============================
# RESTORE DATABASE
# ==============================

Write-Host "Restoring database from local file..." -ForegroundColor Yellow

& $PG_RESTORE `
    -h $POSTGRES_HOST `
    -p $POSTGRES_PORT `
    -U $POSTGRES_USER `
    --clean `
    --if-exists `
    --no-owner `
    -d $DATABASE `
    $targetFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Restore completed successfully." -ForegroundColor Green

    if (-not $SkipResetPassword) {
        Write-Host "Setting default password '123123' for all users..." -ForegroundColor Cyan
        $DEFAULT_HASH = '$2b$10$.YdCzRy/rM4wIKx90lEaE.ss/efnQMEPf.yw6AJw3H6ZK9QH19sFe'
        $SQL_COMMAND = "UPDATE `"User`" SET password = '$DEFAULT_HASH';"
        
        $SQL_COMMAND | & $PSQL -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $DATABASE
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Passwords updated successfully." -ForegroundColor Green
        } else {
            Write-Host "⚠️ Failed to update passwords." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Skipping password update..."
    }
} else {
    Write-Host "❌ Restore failed with exit code $LASTEXITCODE." -ForegroundColor Red
    exit 1
}
