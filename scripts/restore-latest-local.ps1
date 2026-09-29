param (
    [switch]$SkipResetPassword
)

# ==============================
# CONFIG
# ==============================

$MC = "C:\mc.exe"
$MINIO_ALIAS = "prodminio"
$BUCKET = "db-backups"

$LOCAL_BACKUP_DIR = "C:\Temp\db-backups"

$POSTGRES_HOST = "localhost"
$POSTGRES_PORT = "5432"
$POSTGRES_USER = "postgres"
$POSTGRES_PASSWORD = "sigma"

$DATABASE = "hrms"

$PG_RESTORE = "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe"
$PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# ==============================
# CREATE LOCAL FOLDER
# ==============================

New-Item -ItemType Directory -Force -Path $LOCAL_BACKUP_DIR | Out-Null

# ==============================
# GET LATEST BACKUP
# ==============================

Write-Host "Fetching latest backup info..."

$latest = & $MC ls "$MINIO_ALIAS/$BUCKET" --recursive |
    Sort-Object |
    Select-Object -Last 1

if (-not $latest) {
    Write-Host "No backup found."
    exit 1
}

$fileName = ($latest -split '\s+')[-1]

Write-Host "Latest backup: $fileName"

# ==============================
# DOWNLOAD BACKUP
# ============================== 

$localFile = Join-Path $LOCAL_BACKUP_DIR (Split-Path $fileName -Leaf)

Write-Host "Downloading backup..."

& $MC cp "$MINIO_ALIAS/$BUCKET/$fileName" $localFile

if (!(Test-Path $localFile)) {
    Write-Host "Download failed."
    exit 1
}

Write-Host "Resetting schema for clean restore..."

$env:PGPASSWORD = $POSTGRES_PASSWORD

& $PSQL -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $DATABASE -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

Write-Host "Restoring database..."

& $PG_RESTORE `
    -h $POSTGRES_HOST `
    -p $POSTGRES_PORT `
    -U $POSTGRES_USER `
    --clean `
    --if-exists `
    --no-owner `
    -d $DATABASE `
    $localFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Restore completed successfully."

    if (-not $SkipResetPassword) {
        Write-Host "Setting default password '123123' for all users..."
        $DEFAULT_HASH = '$2b$10$.YdCzRy/rM4wIKx90lEaE.ss/efnQMEPf.yw6AJw3H6ZK9QH19sFe'
        $SQL_COMMAND = "UPDATE `"User`" SET password = '$DEFAULT_HASH';"
        
        $SQL_COMMAND | & $PSQL -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $DATABASE
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Passwords updated successfully."
        } else {
            Write-Host "Failed to update passwords."
        }
    } else {
        Write-Host "Skipping password update..."
    }
}
else {
    Write-Host ""
    Write-Host "Restore failed."
}


#===============
#powershell -ExecutionPolicy Bypass -File scripts/restore-latest-dev.ps1
#===============