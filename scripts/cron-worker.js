const https = require('https');
const http = require('http');

/**
 * CRON WORKER
 * This script pings the HRM cron endpoints at specific times.
 */

const CRON_SECRET = process.env.CRON_SECRET || 'royalsv105';
const CRON_URL = process.env.NEXTAUTH_URL_INTERNAL || 'http://localhost:5000';
const CRON_TIMES = (process.env.CRON_TIMES || "").split(',').map(t => t.trim());

const REMINDERS_ENDPOINT = `${CRON_URL}/api/cron/reminders?key=${CRON_SECRET}`;
const MAIN_CRON_ENDPOINT = `${CRON_URL}/api/cron?key=${CRON_SECRET}`;
const CELEBRATIONS_ENDPOINT = `${CRON_URL}/api/cron/celebrations?key=${CRON_SECRET}`;
const RECURRING_TASKS_ENDPOINT = `${CRON_URL}/api/cron/recurring-tasks?key=${CRON_SECRET}`;
const FILE_SHARE_CLEANUP_ENDPOINT = `${CRON_URL}/api/cron/file-share-cleanup?key=${CRON_SECRET}`;

console.log(`[CRON WORKER] Starting...`);
console.log(`[CRON WORKER] Reminders Times: ${CRON_TIMES.join(', ')}`);
console.log(`[CRON WORKER] Main Cron Time: 21:00`);
console.log(`[CRON WORKER] Celebrations Cron Time: 09:35`);
console.log(`[CRON WORKER] Recurring Tasks Cron Time: 09:00`);
console.log(`[CRON WORKER] File Share Cleanup Cron Time: 02:00`);

function triggerEndpoint(url, label) {
  const client = url.startsWith('https') ? https : http;

  client.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`[${new Date().toISOString()}] [${label}] Status: ${res.statusCode}`);
    });
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] [${label}] Error: ${err.message}`);
  });
}

function triggerCron() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // Format: "HH:MM"

  // 1. Reminders: Trigger every minute to ensure shift-wise accuracy
  triggerEndpoint(REMINDERS_ENDPOINT, 'REMINDERS');

  // 2. Main Maintenance (Auto Punch-Out): Trigger at 09:00 PM (21:00)
  if (currentTime === "21:00") {
    triggerEndpoint(MAIN_CRON_ENDPOINT, 'MAIN_CRON');
  }

  // 3. Celebrations (Birthdays & Work Anniversaries): Trigger at 9:35 AM (09:35)
  if (currentTime === "09:35") {
    triggerEndpoint(CELEBRATIONS_ENDPOINT, 'CELEBRATIONS');
  }

  // 4. Recurring Tasks: Trigger at 9:00 AM (09:00)
  if (currentTime === "09:00") {
    triggerEndpoint(RECURRING_TASKS_ENDPOINT, 'RECURRING_TASKS');
  }

  // 5. File Share Cleanup: Trigger at 2:00 AM (02:00)
  if (currentTime === "02:00") {
    triggerEndpoint(FILE_SHARE_CLEANUP_ENDPOINT, 'FILE_SHARE_CLEANUP');
  }

  // 6. Financial Sync: Trigger at 23:50 one day before the last day of the month
  if (currentTime === "23:50") {
    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(now.getDate() + 2);
    // If the day after tomorrow is the 1st, then today is one day before the last day of the month
    if (dayAfterTomorrow.getDate() === 1) {
      triggerEndpoint(`${CRON_URL}/api/cron/financial-sync?key=${CRON_SECRET}`, 'FINANCIAL_SYNC');
    }
  }
}

// Run every minute (60000ms) to check the time
setInterval(triggerCron, 60000);

// Run immediately on start (only triggers if current time matches)
triggerCron();
