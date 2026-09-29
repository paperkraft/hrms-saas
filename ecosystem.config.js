const fs = require('fs');

// Auto-detect .env.production or fallback to .env
const envPath = fs.existsSync('./.env.production') ? './.env.production' : './.env';
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(envPath); } catch (_) {}
  } else {
    try {
      require('dotenv').config({ path: envPath });
    } catch (_) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (!process.env[key]) process.env[key] = val;
            }
          }
        }
      } catch (_) {}
    }
  }
}

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@localhost:5432/hrms?schema=public';
const tunedDbUrl = dbUrl.includes('connection_limit') ? dbUrl : `${dbUrl}&connection_limit=20`;

// Smart CWD and script path resolution
let appCwd = './.next/standalone';
let appScript = 'server.js';

if (fs.existsSync('./server.js')) {
  appCwd = './';
  appScript = 'server.js';
} else if (fs.existsSync('./.next/standalone/server.js')) {
  appCwd = './.next/standalone';
  appScript = 'server.js';
} else if (fs.existsSync('./hrms-standalone-build/server.js')) {
  appCwd = './hrms-standalone-build';
  appScript = 'server.js';
}

module.exports = {
  apps: [
    {
      name: 'hr-app',
      script: appScript,
      cwd: appCwd,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        ...process.env,
        DATABASE_URL: tunedDbUrl,
      },
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M'
    }
  ]
};

