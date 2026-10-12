# Running tests

`npm run test:unit` runs the fast calculation, geometry and data-contract tests.
`npm run test:e2e` runs browser tests on desktop and mobile interaction checks.
Playwright only loads `*.spec.ts`; unit tests run separately.

Tag a browser test `@mobile` when touch interaction or a narrow viewport can
change its behaviour. Use `@mobile-only` for a phone-specific test. Data values,
route aliases and shared DOM contracts run on desktop once. Accessibility tests
check representative pages, keyboard focus, reduced motion and overflow at
320, 768 and 1440 pixels.

For a full mobile run in PowerShell:

```powershell
$env:E2E_FULL_MOBILE = '1'
npx playwright test --config frontend/playwright.config.ts --project mobile
Remove-Item Env:E2E_FULL_MOBILE
```

On Linux or macOS, use
`E2E_FULL_MOBILE=1 npx playwright test --config frontend/playwright.config.ts --project mobile`.

Keep tests that protect calculations, data provenance, privacy and working
interactions. Reuse existing coverage for shared components before adding
another route matrix or assertions about private implementation details.
