const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '*.spec.js', workers: 1, timeout: 45000,
  reporter: 'list', use: { trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true } },
});
