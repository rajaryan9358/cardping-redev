// PM2 process definition for the admin app — mirrors dashboard/ecosystem.config.js.
// Usage: `npm run build` then `pm2 start ecosystem.config.js` from this directory.
module.exports = {
  apps: [
    {
      name: "cardping-admin",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3200",
      },
      max_memory_restart: "300M",
    },
  ],
};
