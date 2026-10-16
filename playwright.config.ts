import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir:'tests/e2e',testMatch:'**/*.spec.ts',workers:1,timeout:45_000,
  reporter:'list',use:{headless:true,trace:'retain-on-failure'},
  // CI/workstation browser installation is separate from the production app.
  // A preinstalled executable can be selected by the test runner environment.
  ...(process.env.TEST_CHROMIUM ? {use:{headless:true,trace:'retain-on-failure',launchOptions:{executablePath:process.env.TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']}}} : {})
});
