# Lumio mobile

Expo / React Native client for the Lumio API (backend and web: [Ugur22/lumio](https://github.com/Ugur22/lumio)).

## API types

`src/api/api.gen.ts` is generated, never edited by hand. The source of truth is `openapi.json` in the lumio repo, which `make types` there regenerates and its `make check` keeps fresh. Generating from it here, with the same `openapi-typescript` version and flags as the web app, keeps both clients on one contract.

```sh
npm run sync:api                          # from lumio main
LUMIO_API_REF=v1.2.0 npm run sync:api     # from a tag or commit (or: scripts/sync-api.sh --ref <ref>)
npm run check:api                         # fails if api.gen.ts differs from lumio main
```

`check:api` needs the network, so it runs in CI (`.github/workflows/ci.yml`) and not in the Stop hook. When it fails, run `npm run sync:api`, fix any type errors it causes in `src/`, and commit the result. The backend only adds fields, because older app versions stay installed.
