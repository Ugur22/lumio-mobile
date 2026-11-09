# Lumio mobile

A native iOS and Android chat app for any OpenAI-compatible API, built with Expo and React Native. It is the mobile client of [Lumio](https://github.com/Ugur22/lumio), which provides the backend and the web app.

<p align="center"><img src="docs/demo.gif" width="300" alt="Chatting in the Lumio app: a short story and a follow-up with a twist ending, streamed live"></p>

## What it does

- **Bring your own provider.** Chat with DeepSeek, Grok, OpenRouter or any other OpenAI-compatible endpoint, and switch provider and model from a sheet in the chat header.
- **Streaming replies** that follow along as they arrive, and keep going when you leave the app.
- **Chats** in a drawer, with rename, delete and a title taken from the first message.
- **Images:** attach photos to a message, or have the model illustrate its reply.
- **Rich replies:** Markdown, code blocks, styled notes and dialogue, rendered safely in light, dark or system theme.
- **Sign in** with a username and password, or with Google or GitHub, and a free trial to try it first.

## Run it

You need Node 22 and the [Expo Go](https://expo.dev/go) app on a phone (or an iOS/Android simulator). No Apple developer account is needed.

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go. The app signs in against the deployed Lumio server by default; to use a local backend (`make dev` in the lumio repo), tap "Change" on the login screen and enter its address. Accounts are created in the web app.

Only use libraries that are bundled in Expo Go. Anything with native code of its own needs a development build.

## Checks

```sh
npm run typecheck
npm test
npm run lint
```

CI runs these plus `check:api` on every pull request. `main` only takes changes through a pull request.

## End-to-end test and demo

Two [Maestro](https://maestro.mobile.dev) flows drive the app in the iOS Simulator. Both share `.maestro/subflows/signed-in.yaml` (open the app in Expo Go, sign in when needed, switch to the flash model). Boot a simulator with Expo Go, run `npx expo start` in another terminal, and set a demo account (not one with private chats):

```sh
export MAESTRO_DEMO_USER='...' MAESTRO_DEMO_PASS='...'   # single quotes: zsh expands `!`
npm run e2e                  # smoke test: sign in, send a message, wait for the reply
scripts/record-demo.sh       # records two short exchanges into docs/demo.gif
```

Needs `maestro` and `ffmpeg` (`brew install mobile-dev-inc/tap/maestro ffmpeg`).

## API types

`src/api/api.gen.ts` is generated, never edited by hand. The source of truth is `openapi.json` in the lumio repo, which `make types` there regenerates and its `make check` keeps fresh. Generating from it here, with the same `openapi-typescript` version and flags as the web app, keeps both clients on one contract.

```sh
npm run sync:api                          # from lumio main
LUMIO_API_REF=v1.2.0 npm run sync:api     # from a tag or commit (or: scripts/sync-api.sh --ref <ref>)
npm run check:api                         # fails if api.gen.ts differs from lumio main
```

`check:api` needs the network, so it runs in CI (`.github/workflows/ci.yml`) and not in the Stop hook. When it fails, run `npm run sync:api`, fix any type errors it causes in `src/`, and commit the result. The backend only adds fields, because older app versions stay installed.
