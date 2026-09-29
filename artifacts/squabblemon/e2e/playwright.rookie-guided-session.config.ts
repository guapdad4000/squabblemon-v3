import { defineConfig } from '@playwright/test';
import { register } from 'tsx/esm/api';
import base from './playwright.config';

register();
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' ');

export default defineConfig({
  ...base,
  testMatch: 'rookie-guided-session.spec.ts',
  projects: base.projects?.filter(project => project.name === 'chromium-desktop' || project.name === 'chromium-phone'),
});