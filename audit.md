## Audit report (beta readiness)

### Overall
- **Stack**: React + TypeScript + Vite; Supabase auth/storage/DB; Supabase Edge Functions (Deno); Tailwind; Vercel hosting.
- **Build status**: App builds successfully; linter reports ~220 errors (mostly types/unused vars) that should be addressed to improve reliability.

### Functionality testing risks
- **Client upload flow**: Relies on `upload_token` in URL; records marked `uploaded_via_token`. Works, but lacks rate limiting and abuse checks.
- **Dead code signals**: Many components contain unused states/variables; indicates incomplete UI logic and potential dead code.
- **Testing**: No automated tests detected; manual regression risk is high.

### Bugs and defects (examples)
- **ESLint**: Numerous errors across `src/pages/*`, `src/hooks/*`, `src/components/ui/*`, and edge functions; includes rule violations and `any` types.
- **React Hooks**: Some hooks violate rules (missing dependencies, hooks called in non-hook functions).
- **Storage path**: Potential filename path duplication in `DocumentService.generateUniqueFilename` combined with `storagePath` prefix formatting; verify storage path expectations.
- **Schema mismatch**: `ClientUpload` inserts `processing_status` on `documents`, but other code expects `is_processed`; ensure column consistency.

### Performance
- **Bundle size**: Built JS bundle ~951 kB (gzipped ~238 kB). Consider more aggressive code-splitting and dynamic imports for routes and heavy UI.
- **Code splitting**: No route-level `React.lazy` in app code; only mentioned in docs.
- **Image processing**: Images compressed client-side only for large files; consider server-side or worker-based processing for large uploads.
- **Build config**: Add `build.chunkSizeWarningLimit` and `manualChunks` to split vendor chunks.

### Security
- **High-risk token persistence**: LocalStorage token persistence in `src/hooks/useAuth.ts` stores `supabase.auth.token` manually. This increases XSS impact. Remove and rely on Supabase client’s own persistence, or switch to memory/session with strict CSP.
- **Verbose logging**: Excessive console logs of environment and auth state (`src/lib/supabase.ts`, `AuthContext`, `useAuth`) reveal URLs, token structure, and timings. Remove in production or guard with `NODE_ENV`.
- **CORS (Vercel)**: Headers allow `*` with `Access-Control-Allow-Credentials: true` which is incompatible and risky. Restrict origins to app domains, remove credentials if using wildcard.
- **CORS (Edge functions)**: Use of `'*'` origins. Restrict to known origins.
- **Secrets**: Public exposure of `assistant_id` constants in edge functions; low severity but avoid hardcoding internal IDs.
- **Webhook verification**: Implemented with Svix and uses `RESEND_WEBHOOK_SECRET` properly.
- **Secrets handling**: No plaintext keys in repo; environment variables are referenced correctly. Keep rotating per `security_review.md` recommendations.
- **RLS**: Profiles and documents have RLS and policies present; documents policy checks both `user_id` and client ownership. Good.
- **CSRF**: SPA + Supabase token approach is OK; ensure no cookie-based auth. CORS tightening still needed.
- **XSS**: No `dangerouslySetInnerHTML` usages found; emails generate HTML server-side. Keep sanitizing any future rich text.
- **target=blank**: None found; good.

### Data integrity and backup
- **Migrations**: Set RLS, constraints, and indexes for `documents`; includes composite indexes for performance. Good.
- **Backups**: No explicit backup/disaster-recovery tooling in repo. Ensure Supabase project has PITR and backups configured.
- **Upload flow**: `ClientUpload` updates `document_request_items` on upload; good. Ensure transactions or idempotency to avoid partial state if email/log insert fails.

### Third-party dependencies
- **Vulnerabilities**: `npm audit` shows 7 vulnerabilities (1 high in `cross-spawn`, multiples in Vite, esbuild, nanoid, babel). Fixes available via updates.
- **Outdated packages**: Many core packages can be updated (`vite`, `@vitejs/plugin-react`, `@supabase/supabase-js`, `eslint` suite, `resend`). React 18 is fine; React 19 optional.
- **Versioning**: Consider pinning versions and enabling Dependabot/Renovate.

### Deployment and configuration
- **Vercel**: `vercel.json` rewrites index and sets permissive headers. Tighten before production.
- **Vite**: Config is simple; add code splitting and CSP support.
- **Env**: Ensure production `.env` has `VITE_*` only for values safe to expose to browser.

### Observability
- **Logging**: Extensive console logging across client and edge functions; add runtime-level logging controls and scrub PII.
- **Metrics/Tracing**: No metrics/tracing. Consider Vercel Analytics, Supabase logs alerts, Sentry for FE/BE errors.

### Documentation
- **Docs**: Rich docs present (`README`, `QUICK_START_GUIDE`, `DEPLOYMENT_GUIDE`, `security_review.md`). Add a runbook for rotation of secrets and incident response.

### Prioritized action plan
1) **Security must-fix before beta**
   - Remove manual LocalStorage token writes in `useAuth`. Rely on Supabase’s `persistSession` or `sessionStorage`. Add strict CSP (`script-src 'self'` with nonce, `default-src 'self'`, `connect-src` whitelisted).
   - Guard logs: remove or wrap sensitive logs with `if (import.meta.env.MODE !== 'production')`.
   - Validate `upload_token` abuse:
     - Add rate limiting and IP throttling at edge.
     - Expiration and single-use or limited-use tokens; server-side validation and revocation.
   - Ensure consistent schema: harmonize `documents` fields (`is_processed` vs `processing_status`).

2) **Performance and UX**
   - Introduce route-level code splitting with `React.lazy` and `Suspense` for pages under `src/pages/*`.
   - Configure `vite.config.ts` `build.rollupOptions.output.manualChunks` to split vendor bundles.
   - Audit large components (`ClientCommunications`, `DocumentManagement`) for memoization and virtualization if big lists.
   - Preload critical CSS; consider removing unused Tailwind classes where possible.

3) **Dependencies and tooling**
   - Update vulnerable packages: `vite >=7.1.5`, `esbuild`, `nanoid`, `@babel/helpers`, `cross-spawn`, `eslint` stack, `@supabase/supabase-js`.
   - Add lockfile maintenance and Dependabot/Renovate.
   - Add `npx update-browserslist-db@latest` step in CI monthly.

4) **Observability**
   - Add Sentry for React and Deno edge functions.
   - Set up Supabase log drains and alerts for 5xx and auth anomalies.
   - Mask PII in logs; add request IDs to edge responses.

5) **Testing and quality**
   - Introduce basic E2E smoke tests (Playwright) for auth, doc upload, bookkeeping and client upload token flow.
   - Add unit tests for `DocumentService` and `documentQueries`.
   - Fix ESLint errors or relax rules where appropriate. Enforce CI lint gate.

6) **Data integrity and recovery**
   - Confirm Supabase PITR/backups, retention and GDPR/CCPA compliance.
   - Add migrations for token expiry, rate limit storage (e.g., per-token request counts).

7) **Deployment and config**
   - Separate `.env.production` with only safe `VITE_*`. All sensitive keys used only on server/edge.
   - Ensure `APP_URL` is your canonical domain; don’t default to Vercel preview URL in production.

### Key code edits recommended
- **Remove risky token persistence and noisy logs**:
  - `src/hooks/useAuth.ts`: remove `localStorage.setItem('supabase.auth.token', ...)`.
  - `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`: guard console logs by environment.
- **Add chunking**:
  - `vite.config.ts`: add `build.rollupOptions.output.manualChunks` and potentially `build.chunkSizeWarningLimit`.
- **Schema consistency**:
  - Align `documents` processing field across UI and functions; adjust queries and updates accordingly.


