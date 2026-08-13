// PM2 process definition — alternative to Docker for running directly on a
// VPS. Usage: `pm2 start ecosystem.config.js` after `npm run build`.
module.exports = {
  apps: [
    {
      name: "cardping-server",
      script: "dist/src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
    },
  ],
};
