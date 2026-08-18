# CI/CD

Two GitHub Actions workflows, both in [`.github/workflows/`](../.github/workflows/):

## `ci.yml`

Runs on every push (any branch) and every pull request: `npm ci`, `npm run typecheck`,
`npm run build`, for each of `server/`, `dashboard/`, and `admin/` (a build matrix — three parallel
jobs, one per app). No real secrets needed, no deploy — `admin/`'s job gets a handful of
placeholder env values (see the `env:` block in the workflow file) just to satisfy its build-time
schema validation, never anything that touches a real Supabase project. This is purely "does it
still compile," and is a good candidate to mark as a **required status check** on `main` in the
GitHub repo's branch protection settings once you have one, so a broken build can't be merged.

## `deploy.yml`

Runs on every push to `main` (or manually, via the "Run workflow" button — it has
`workflow_dispatch` enabled):

1. **`build` job** — the identical typecheck/build gate as `ci.yml`. If this fails, the `deploy`
   job (which `needs: build`) never runs — a red build never reaches the VPS.
2. **`deploy` job** — SSHes into the VPS ([`appleboy/ssh-action`](https://github.com/appleboy/ssh-action))
   and, for each of `server/`, `dashboard/`, `admin/` in turn, runs:
   ```bash
   cd $VPS_DEPLOY_PATH
   git fetch origin main
   git reset --hard origin/main
   cd server        # then dashboard, then admin
   npm ci
   npm run build
   npm prune --omit=dev
   pm2 startOrReload ecosystem.config.js --update-env
   pm2 save
   ```
   `npm ci` installs everything, including `typescript`/`next` — the build tooling needs to be
   present to run `npm run build` at all. `npm prune --omit=dev` then strips `devDependencies`
   back out once the build output exists, so the `node_modules` PM2 actually runs against stays
   lean. (An earlier version of this script ran `npm ci --omit=dev` up front, which skipped
   `typescript` entirely and made every deploy fail at the build step with `tsc: not found`.)

   `pm2 startOrReload` starts the app if it isn't running yet, or reloads it in place if it is —
   the same command works for the very first deploy and every one after. `admin/`'s real `.env`
   (unlike CI's placeholders) lives only on the VPS, same as `server/.env` — see
   [HOSTINGER_VPS_SETUP.md §11](./HOSTINGER_VPS_SETUP.md#11-deploy-the-admin-app).

## Required GitHub secrets

Set these in the repo → **Settings → Secrets and variables → Actions → New repository secret**.
All five are required for `deploy.yml` to work.

| Secret | Value |
|---|---|
| `VPS_HOST` | The VPS IP address (or hostname, if you've pointed one at it) |
| `VPS_USER` | `deploy` (the non-root user from [HOSTINGER_VPS_SETUP.md](./HOSTINGER_VPS_SETUP.md)) |
| `VPS_SSH_KEY` | The **private** half of the dedicated deploy key — paste the whole file contents, including the `-----BEGIN...-----`/`-----END...-----` lines |
| `VPS_PORT` | `22`, unless you've changed the VPS's SSH port |
| `VPS_DEPLOY_PATH` | Where the repo is cloned on the VPS, e.g. `/var/www/cardping` |

None of these are environment variables the *app* reads (that's `server/.env`, which lives only
on the VPS and is never touched by CI) — they're only used by the GitHub Actions runner to reach
the VPS over SSH.

## Testing the deploy key before relying on CI

From your own machine, with the private key you generated:

```bash
ssh -i ~/cardping_deploy_key deploy@YOUR_VPS_IP "echo it works"
```

If that doesn't print `it works`, `deploy.yml` won't either — fix the SSH access first (see
[HOSTINGER_VPS_SETUP.md §10](./HOSTINGER_VPS_SETUP.md#10-set-up-the-github-actions-deploy-key))
before debugging it through GitHub Actions logs.

## Rolling back a bad deploy

`deploy.yml` always deploys whatever `main` currently points at. To roll back:

```bash
git revert <bad-commit>   # or: git reset --hard <good-commit> && git push --force
```

pushing either to `main` triggers a normal deploy of the reverted state — no separate rollback
mechanism needed. For a faster stop-the-bleeding option while you sort out the fix, SSH in
directly and run `pm2 stop cardping-server` (and `pm2 start cardping-server` once ready).

## Why no automated tests run here

There's no test suite in this project yet (see the repo root — no `tests/` folder). `ci.yml`
currently only proves the TypeScript compiles, not that the bot logic is correct. If you add
tests later (e.g. `vitest` against `services/*` and the webhook normalizers, which are pure
functions and cheap to test), add `npm test` as a step in both `ci.yml` and `deploy.yml`'s
`build` job.
