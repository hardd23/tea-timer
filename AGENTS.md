# Tea Timer agent guide

## Project map

- `app/` is the Next.js Tea Timer application.
- `docs/` is the separate GitHub Pages landing page.
- `out/` and `android/app/src/main/assets/` are generated web output.
- `android/` is the Capacitor Android wrapper; generated Capacitor files should be updated with `npx cap sync android`, not edited by hand.

## Constraints

- Preserve timer behavior, RU/EN localization, links, screenshots, and the current visual design unless the task explicitly changes them.
- Do not change `android/app/build.gradle` signing configuration or release credentials unless explicitly requested.
- Never commit keystores, `keystore.properties`, environment files, build output, or local audit artifacts.
- Preserve unrelated user changes and avoid new dependencies unless they are required by the task.

## Verification

- `npm run typecheck` performs a fast standalone TypeScript check.
- `npm run verify:versions` checks that `package.json` version matches Android `versionName`.
- `npm run test:unit` runs the unit tests once.
- `npm run check` is the required web gate: ESLint, version sync, unit tests, and the production static build.
- For Android packaging, run the web build before `npx cap sync android`, then use the Gradle wrapper from `android/`.
- Report the exact commands run, their results, and every changed file.
