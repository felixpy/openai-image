# Contributing

Thanks for helping with `@felixpy/openai-image`. This project is a small stdio MCP server. Keep changes focused, and do not add transports or tools that the README does not already describe.

## Code of conduct

Participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Requirements

- Node.js 20 or newer
- npm (the lockfile is npm's `package-lock.json`)

## Run locally

```sh
npm ci
npm test
npm run build
npm start
```

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Builds `dist/`, then runs the stdio smoke test |
| `npm run build` | Compiles `src/` to `dist/` |
| `npm start` | Runs `node dist/index.js` |

The smoke test spawns the server and completes MCP `initialize` and `tools/list`. It does not call the OpenAI API and does not need `OPENAI_API_KEY`.

Do not commit `node_modules/`, `dist/`, `.env`, API keys, or generated images.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>

[optional body]
```

| Type | Release Please |
|---|---|
| `feat` | Minor bump while the package is 0.x (`0.1.0` → `0.2.0`) |
| `fix` | Patch bump |
| `feat!` or `BREAKING CHANGE:` | Minor bump before 1.0.0 (`bump-minor-pre-major`) |
| `docs`, `chore`, `ci`, `test`, `refactor` | No release by themselves |

Write the subject in the imperative mood, for example `fix: reject a relative output_dir`.

## Pull requests

- Explain what changed and how you tested it.
- Run `npm test` and `npm run typecheck` before asking for review.
- Update `README.md` and `README_ZH.md` together when user-facing behavior changes.
- Fill in the pull request template.
- Do not include secrets, request logs that contain an API key, or local output images.

`@felixpy` is the code owner in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Publishing

Releases are cut by Release Please from Conventional Commits on `main`, then published with npm Trusted Publishing. There is no `NPM_TOKEN` secret. The first publish of the scoped package is manual. See [docs/publishing.md](docs/publishing.md).
