/**
 * PM2 Ecosystem Configuration
 *
 * Start all:     pnpm dev:start
 * Stop all:      pnpm dev:stop
 * Status:        pnpm dev:status (or: pnpm exec pm2 status)
 * Restart one:   pnpm dev:restart <name>
 * Logs:          pnpm dev:logs [name]
 * Kill daemon:   pnpm dev:kill
 *
 * Service names: common, server, client, pubsub, pyserver
 */

const path = require("path");

module.exports = {
  apps: [
    {
      name: "common",
      cwd: path.join(__dirname, "common"),
      script: "pnpm",
      args: "run watch",
      interpreter: "none",
      watch: false,
      autorestart: false, // Don't restart tsc watch
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "server",
      cwd: path.join(__dirname, "express-server"),
      script: "pnpm",
      args: "run dev",
      interpreter: "none",
      watch: false,
      autorestart: true,
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "client",
      cwd: path.join(__dirname, "next-client"),
      script: "pnpm",
      args: "run dev",
      interpreter: "none",
      watch: false,
      autorestart: true,
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "pubsub",
      script: "gcloud",
      args: "beta emulators pubsub start --host-port=localhost:8085",
      interpreter: "none",
      watch: false,
      autorestart: true,
      restart_delay: 2000,
    },
    {
      name: "pyserver",
      cwd: __dirname,
      script: path.join(__dirname, "pyserver/.venv/bin/uvicorn"),
      args: "--app-dir pyserver main:app --reload --host 0.0.0.0 --port 8000",
      interpreter: "none",
      watch: false,
      autorestart: true,
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
