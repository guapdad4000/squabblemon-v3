import { defineConfig } from '@playwright/test';
import base from './playwright.district-reminders.config';
export default defineConfig({ ...base, testMatch: ['battle-hud-stability.spec.ts', 'battle-reading-regression.spec.ts'], outputDir: '../test-results/hud-stability' });
