# Multi-Instance Deployment Guide (Infraplan & Future Companies)

This guide explains how to set up, configure, and run an independent HRMS instance for **Infraplan** alongside **Sigma** with 100% data isolation, custom branding, and separate storage.

---

## 1. Architecture Overview

Both instances run from the same code repository but with separate runtime environments:

| Component | Sigma Instance | Infraplan Instance |
| :--- | :--- | :--- |
| **Domain / URL** | `https://hrms.sigma.com` | `https://hrms.infraplan.co.in` |
| **Port** | `5000` | `5001` |
| **PostgreSQL Database** | `hrms` (or `hrms_sigma`) | `hrms_infraplan` |
| **MinIO Storage Bucket**| `hrms` | `infraplan-hrms` |
| **App Name** | `Sigma HRMS` | `Infraplan HRMS` |
| **Company Legal Name** | `SIGMA INFRAPLAN ENGINEERING PVT. LTD.` | `INFRAPLAN ENGINEERING PRIVATE LIMITED` |
| **PM2 Process Name** | `hr-app-sigma` | `hr-app-infraplan` |

---

## 2. Step-by-Step Setup for Infraplan

### Step A: Create the PostgreSQL Database
Open PostgreSQL CLI (`psql`) or pgAdmin on the server:
```sql
CREATE DATABASE hrms_infraplan;
```

### Step B: Push Database Schema
Run Prisma database push targeting the new database:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/hrms_infraplan?schema=public" npx prisma db push
```

*(Optional)* Seed initial admin user/departments if needed:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/hrms_infraplan?schema=public" npx tsx prisma/seed.ts
```

---

### Step C: Create MinIO Storage Bucket
1. Open MinIO Console (e.g., `https://storage.infraplan.co.in:9001`).
2. Create a new bucket named `infraplan-hrms`.
3. Set appropriate read/write access policies or user credentials.

---

### Step D: Configure `.env.production` for Infraplan

Create `.env.production` in the Infraplan instance directory:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/hrms_infraplan?schema=public"

# Auth
NEXTAUTH_SECRET="GenerateRandomSecretHere"
NEXTAUTH_URL="https://hrms.infraplan.co.in"
PORT=5001

# Branding & Letterhead
NEXT_PUBLIC_APP_NAME="Infraplan HRMS"
NEXT_PUBLIC_COMPANY_NAME="Infraplan"
COMPANY_FULL_NAME="INFRAPLAN ENGINEERING PRIVATE LIMITED"
NEXT_PUBLIC_COMPANY_FULL_NAME="INFRAPLAN ENGINEERING PRIVATE LIMITED"
COMPANY_ADDRESS="C.S. No.2101, Plot No.13, Laxmi Nagar, E Ward, Kolhapur 416005, Maharashtra, India."
NEXT_PUBLIC_COMPANY_ADDRESS="C.S. No.2101, Plot No.13, Laxmi Nagar, E Ward, Kolhapur 416005, Maharashtra, India."
NEXT_PUBLIC_COMPANY_TAGLINE="Advanced HR and Attendance Management Platform."

# Master Accounts & Dummy Filters
DEV_ADMIN_EMAIL="dev@infraplan.com"
DUMMY_EMAIL_DOMAIN="@infraplan.com"
NEXT_PUBLIC_DUMMY_EMAIL_DOMAIN="@infraplan.com"

# Email / SMTP
SMTP_HOST="190.92.174.125"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@infraplan.co.in"
SMTP_PASS="Kolhapur!@#2026"
SMTP_FROM='"Infraplan HRMS" <noreply@infraplan.co.in>'

# MinIO Storage
MINIO_ENDPOINT=storage.infraplan.co.in
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=infraplan
MINIO_SECRET_KEY=infraplan_secret
MINIO_BUCKET=infraplan-hrms

# Cron & Push Notifications
CRON_SECRET="infraplan_cron_secret_2026"
CRON_TIMES="09:20,09:35,17:50,18:00"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your_vapid_public_key"
VAPID_PRIVATE_KEY="your_vapid_private_key"
```

---

### Step E: Configure PM2 (`ecosystem.config.js`)

In the server's PM2 configuration, declare both applications:

```javascript
module.exports = {
  apps: [
    {
      name: 'hr-app-sigma',
      script: 'server.js',
      cwd: './instances/sigma/.next/standalone',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DOTENV_CONFIG_PATH: './instances/sigma/.env.production'
      }
    },
    {
      name: 'hr-app-infraplan',
      script: 'server.js',
      cwd: './instances/infraplan/.next/standalone',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        DOTENV_CONFIG_PATH: './instances/infraplan/.env.production'
      }
    }
  ]
};
```

---

### Step F: Nginx / IIS Reverse Proxy Setup

#### Nginx Example:
```nginx
# Sigma HRMS
server {
    server_name hrms.sigma.com;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Infraplan HRMS
server {
    server_name hrms.infraplan.co.in;
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Maintenance & Updates
Whenever new features or bug fixes are developed:
1. Pull latest code from Git.
2. Build standalone package: `npm run build`.
3. Deploy build files to both instances.
4. Run `npx prisma db push` against both databases (if database schema was modified).
5. Reload PM2 processes: `pm2 reload all`.
