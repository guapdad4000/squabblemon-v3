import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:['bounty-premium.spec.ts','growth-compact.spec.ts'],workers:1,timeout:45000,use:{baseURL:process.env.UI_ORIGIN??'http://127.0.0.1:4198',browserName:'chromium',launchOptions:{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']},screenshot:'only-on-failure'}});
