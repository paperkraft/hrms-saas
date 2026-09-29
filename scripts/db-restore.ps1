# Database Restore Script for HRMS (Clean & Restore)
# WARNING: This script drops and recreates the database. All current data will be lost!

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$psqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$dbName = "hrms"
$dbUser = "postgres"
$dbPort = "5432"
$env:PGPASSWORD = "Admin@123"

if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file not found at $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "WARNING: You are about to DESTROY and RECREATE the '$dbName' database." -ForegroundColor Yellow
Write-Host "All current data will be replaced with data from: $BackupFile" -ForegroundColor Gray
$confirmation = Read-Host "Are you sure you want to proceed? (Type 'YES' to confirm)"

if ($confirmation -ne "YES") {
    Write-Host "Operation cancelled by user." -ForegroundColor Red
    exit 0
}

Write-Host "Starting clean restore process..." -ForegroundColor Cyan

try {
    # 1. Terminate active connections to the database
    Write-Host "Terminating active connections to '$dbName'..." -ForegroundColor Gray
    $terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid != pg_backend_pid();"
    & $psqlPath -U $dbUser -p $dbPort -d postgres -c $terminateSql | Out-Null

    # 2. Drop the database
    Write-Host "Dropping database '$dbName'..." -ForegroundColor Gray
    & $psqlPath -U $dbUser -p $dbPort -d postgres -c "DROP DATABASE IF EXISTS $dbName;" | Out-Null

    # 3. Create the database
    Write-Host "Creating fresh database '$dbName'..." -ForegroundColor Gray
    & $psqlPath -U $dbUser -p $dbPort -d postgres -c "CREATE DATABASE $dbName;" | Out-Null

    # 4. Restore from backup
    Write-Host "Restoring data from backup file..." -ForegroundColor Cyan
    & $psqlPath -U $dbUser -p $dbPort -d $dbName -f $BackupFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Clean restore completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Restore failed during SQL execution." -ForegroundColor Red
    }
} catch {
    $msg = $_.Exception.Message
    Write-Host "Fatal error: $msg" -ForegroundColor Red
}
