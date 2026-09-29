# Database Maintenance Guide - HRMS

This document outlines the procedures for backing up and restoring the HRMS PostgreSQL database.

## 🗄️ Backup Options

We provide two ways to back up your data, depending on your needs.

### 1. Native SQL Dump (Recommended for Production)
This is the "Gold Standard" backup. It uses PostgreSQL's native `pg_dump` tool to create a complete SQL script of your database, including schema, indexes, and data.

**To take a backup:**
```bash
npm run db:dump
```
*   **Target Folder:** `C:\Backups`
*   **Format:** `.sql`
*   **Security:** You will be prompted for the database password (`Admin@123`).

### 2. Portable JSON Backup
This creates a human-readable JSON file. It is useful for data inspection or moving data between different types of databases (e.g., from SQLite to Postgres).

**To take a backup:**
```bash
npm run db:backup
```
*   **Target Folder:** `./backups` (inside the project directory)
*   **Format:** `.json`

---

## 🔄 Restoration Procedures

### 1. Clean Restore (SQL Dump)
This is the most reliable way to restore. It **drops** the existing database, creates a **fresh** one, and imports all data from your `.sql` file.

**Command:**
```bash
npm run db:restore-dump -- C:\Backups\your_file_name.sql
```
*   **Confirmation:** You must type `YES` to confirm the operation.
*   **Connections:** The script automatically terminates any active connections (like the running app) to ensure the database can be safely dropped.

### 2. Selective Restore (JSON)
Restores data from a JSON file. Use this if you only want to restore model data without touching the database schema.

**Command:**
```bash
npm run db:restore -- your_file_name.json
```

---

## 💡 Best Practices

*   **Frequency:** Run `npm run db:dump` at least once a day.
*   **Off-site Storage:** Regularly copy your `C:\Backups` files to a secure cloud storage or an external drive.
*   **Testing:** Occasionally restore a backup to a "test" database to ensure your backup files are healthy.
*   **Schema Changes:** Whenever you modify `prisma/schema.prisma`, take a fresh backup immediately after running `npx prisma db push`.

---

## 🛠️ Troubleshooting

**"pg_dump is not recognized"**
Ensure PostgreSQL is installed and the path in `scripts/db-dump.ps1` matches your installation (e.g., `C:\Program Files\PostgreSQL\17\bin`).

**"Database in use" during restore**
The `db:restore-dump` script handles this automatically. If it still fails, manually stop your PM2 processes before restoring:
```bash
pm2 stop all
```
