import { defineConfig } from '@playwright/test';
import base from './playwright.rookie-guided-session.config';

export default defineConfig({
  ...base,
  testMatch: [
    'rookie-guided-session.spec.ts',
    'rookie-practice-review.spec.ts',
    'rookie-review-scroll.spec.ts',
    'battle-reading-regression.spec.ts',
  ],
});