# Landscaping CMS

Next.js CMS + website for landscaping businesses.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill required values.
3. Run:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Required environment variables (Vercel)

Set these in Vercel Project Settings -> Environment Variables:

- `ADMIN_PASSWORD`: password used to access and publish from `/admin`.
- `GITHUB_TOKEN`: GitHub PAT with repo write access.
- `GITHUB_OWNER`: GitHub username/org.
- `GITHUB_REPO`: repository name.
- `GITHUB_BRANCH`: branch used for CMS commits (usually `main`).
- `CONTENT_CACHE_TTL_SECONDS` (optional): runtime cache TTL for site content. Default is `30`.

## Exact CMS publish flow on Vercel

1. Open `/admin` on your deployed domain.
2. Sign in using `ADMIN_PASSWORD`.
3. Edit content, then publish.
4. CMS API (`/api/update-json`, `/api/upload-image`, `/api/delete-image`) writes directly to GitHub on the configured branch.
5. Public site reads content from GitHub at runtime (with short server cache), so content updates propagate without waiting for static bundled JSON.
6. If Vercel is connected to the same repo/branch, GitHub commit also triggers a fresh deployment automatically.

## Important wiring requirement

For consistent behavior, use the same repository + branch in both:

- Vercel Git integration
- CMS GitHub env vars (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`)

If they point to different branches/repos, CMS updates may commit successfully but not appear on your deployed site.

## Security behavior

- CMS read and write endpoints require `ADMIN_PASSWORD`.
- Admin UI only grants access after a protected server read succeeds.

## Production checks

After deployment:

1. Open `/admin`, sign in, change one text field, publish.
2. Verify new commit appears in GitHub.
3. Verify updated content appears on live site.
4. If not, verify env vars and repo/branch alignment in Vercel.

## Branch-based redeploy pipeline

This repo includes `.github/workflows/vercel-branch-redeploy.yml` with this behavior:

- Push to `main` -> trigger production redeploy.
- Push to `dev` -> trigger development redeploy.

### Required GitHub repository secrets

Add these in GitHub -> Settings -> Secrets and variables -> Actions:

- `VERCEL_PROD_DEPLOY_HOOK_URL`
- `VERCEL_DEV_DEPLOY_HOOK_URL`

### Create deploy hooks in Vercel

In Vercel Project Settings, create 2 deploy hooks:

1. Production hook for branch `main`.
2. Development hook for branch `dev`.

Copy their URLs into the GitHub secrets above.

### Important

If Vercel Git auto-deploy is still enabled for these branches, each push can create duplicate deployments (one from Vercel Git integration + one from GitHub Action hook). Keep only one deployment trigger strategy.

This repo sets `git.deploymentEnabled: false` in `vercel.json`, so direct Git pushes do not trigger Vercel deployments. Deployments are triggered only by the GitHub Action hooks above (`main` -> production, `dev` -> development).
