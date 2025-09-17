import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || 'https://84b13961cb2a4cdd657f4cbb7c9b5272@o4509583266021376.ingest.de.sentry.io/4510030637695056';
const SENTRY_ENV = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'development';
const TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENV,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: TRACES_SAMPLE_RATE,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
});

// One-time self-test to verify Sentry wiring in the browser
try {
  const key = 'sentrySelfTestDone';
  if (!localStorage.getItem(key)) {
    Sentry.captureException(new Error('taxos-web-react self-test error'));
    localStorage.setItem(key, '1');
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
