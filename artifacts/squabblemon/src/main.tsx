import { createRoot } from 'react-dom/client';

import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const root = createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
});

if (import.meta.env.VITE_BATTLE_PERF === '1' && new URLSearchParams(window.location.search).has('__battle_perf')) {
  const { BattlePerfHarness } = await import('./components/BattlePerfHarness');
  root.render(<BattlePerfHarness />);
} else {
  const { default: App } = await import('./App');
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
