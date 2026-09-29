module.exports = {
  apps: [
    {
      name: 'hr-cron',
      script: 'scripts/cron-worker.js',
      cwd: './',
      env: {
        CRON_SECRET: 'royalsv105',
        NEXTAUTH_URL_INTERNAL: 'http://localhost:5000',
        CRON_TIMES: '09:20,09:35,17:50,18:05'
      },
      autorestart: true,
      watch: false
    }
  ]
};
