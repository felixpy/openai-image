# Publishing `@felixpy/openai-image`

Releases are automated. Conventional Commits on `main` open a Release Please pull request that bumps `package.json` and `CHANGELOG.md`. Merging that pull request tags `vX.Y.Z` and publishes to npm with provenance. The publish job uses GitHub Actions OIDC (npm Trusted Publishing). It does not read an `NPM_TOKEN` secret.

The workflow file npm must trust is exactly `release.yml`.

## One-time setup

Trusted Publishing can only be configured on a package that already exists, and a brand-new trusted publisher must complete one successful publish within two days or it expires. Do the steps in this order.

### 1. Publish `0.1.0` once, by hand

`0.1.0` in this repository is the baseline. The manifest in `.release-please-manifest.json` already records it, and `release-please-config.json` sets `bootstrap-sha` to the empty initial commit, so merging the bootstrap pull request does not publish.

From a checkout of `main` after that pull request is merged:

```sh
npm login
npm ci
npm publish --access public
```

`publishConfig.access` is `public`, and `prepublishOnly` runs the build. Confirm `https://www.npmjs.com/package/@felixpy/openai-image` shows `0.1.0`.

Use a normal npm login for this one publish. Do not add an `NPM_TOKEN` repository secret for CI.

### 2. Add the trusted publisher

On the package page: **Settings → Trusted Publisher → GitHub Actions**.

| Field | Value |
|---|---|
| Organization or user | `felixpy` |
| Repository | `openai-image` |
| Workflow filename | `release.yml` |
| Environment name | leave empty |

The publish job does not set a GitHub Environment, so the environment field on npm must stay empty. The filename is only `release.yml`, not the `.github/workflows/` path.

Trusted publishers created after 2026-09-03 allow `npm stage publish` by default. This workflow runs `npm publish`, so also allow direct **npm publish**.

`package.json` `repository.url` is `git+https://github.com/felixpy/openai-image.git`. npm checks that it matches this GitHub repository.

### 3. Validate the publisher within two days

A new trusted publisher is not active until one OIDC publish succeeds, and that must happen within two days of saving the configuration. After step 2, land a `fix:` or `feat:` commit, merge the Release Please pull request, and let `.github/workflows/release.yml` publish the next version. That publish validates the publisher.

If the two days pass first, delete the expired configuration, create it again, and publish within the new window.

### 4. Optional: disallow tokens

After the OIDC publish works, set **Publishing access** to require two-factor authentication and disallow tokens. Trusted Publishing keeps working. Revoke any automation token you created for the manual `0.1.0` publish if you no longer need it.

Provenance is attached automatically for a public package published from this public repository. The workflow also passes `--provenance`.

## What the workflow needs

- Node.js 22.14 or newer and npm 11.5.1 or newer. The publish job uses Node 22 and installs npm 11.
- `permissions: id-token: write` on the publish job. This is already set.
- GitHub-hosted runners. Trusted Publishing does not support self-hosted runners.
- Repository **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**, so Release Please can open the release pull request with the default `GITHUB_TOKEN`.

Pull requests that Release Please opens with `GITHUB_TOKEN` do not start other workflows. CI on those release pull requests stays quiet unless you add a personal access token later. Publishing does not depend on that: the publish job is in the same `release.yml` run that creates the tag when the release pull request merges.

`bootstrap-sha` applies only until the first Release Please pull request exists. You can remove it after that.

## Local checks before you tag anything by hand

```sh
npm ci
npm test
npm run build
npm pack --dry-run
```

The packed tarball should contain `dist/`, `LICENSE`, `README.md`, and `package.json`.
