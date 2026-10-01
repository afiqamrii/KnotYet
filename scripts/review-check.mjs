// Start Vite on port 5174 before this suite, or set SMOKE_URL to its origin.
// All browser checks use local fixtures; no account sign-in is required.
const base = process.env.SMOKE_URL || process.env.KNOTYET_TEST_URL || 'http://localhost:5174';
process.env.SMOKE_URL = base;
process.env.KNOTYET_TEST_URL = base;

const checks = [
  './question-content-check.mjs',
  './question-history-check.mjs',
  './game-intro-check.mjs',
  './card-sync-check.mjs',
  './choices-check.mjs',
  './game-modes-review-check.mjs',
  './gameplay-regression-check.mjs',
];

try {
  const response = await fetch(new URL('/@vite/client', base), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch (error) {
  throw new Error(`Game checks need the Vite dev server at ${base}. Run npm run dev -- --port 5174, or set SMOKE_URL to the running server.`, { cause: error });
}

for (const check of checks) {
  console.log(`Running ${check.slice(2)}`);
  await import(check);
}
console.log('Game review checks passed.');
