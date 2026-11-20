# Phase 1c: Frontend Shell: Deployment Guide

## 1. Put the code on GitHub
1. Create a NEW public repository, e.g. `store-app` (or empty your old test repository: the Vite project needs its own `index.html`).
2. Upload everything from this folder, **keeping the folder structure** (including the hidden `.github/workflows/deploy.yml`).
   Drag whole folders into the GitHub upload page, or use GitHub Desktop.

## 2. Two settings on GitHub
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables → New repository variable:**
   Name `API_URL`, value = your **Worker address** (`https://store-api.YOUR-NAME.workers.dev`).
   (A variable, not a secret: the address is not private.)

## 3. Deploy
Commit to `main`. Open the **Actions** tab and wait for a green tick (about 1-2 minutes).
Your app is at `https://YOUR-USERNAME.github.io/REPO-NAME/`.
The Worker's `ALLOWED_ORIGIN` (`https://YOUR-USERNAME.github.io`) does not change.
If the build fails, open the failed run and send me the red error text.

## 4. First login
Login page → **First time? Activate account** → username, the setup code from step 2 of the backend guide, and a new password (10+ characters).

## 5. Phase 1 gate checklist (do on desktop AND phone)
- [ ] Activate the first Admin, then you are signed in; the Dashboard says "Server: connected"
- [ ] Refresh the page: still signed in. Close the tab and reopen: signed out (by design)
- [ ] Wrong password shows a clear message
- [ ] Users page: add a STAFF user, copy the setup code, activate that user on another browser or private window
- [ ] The Staff user has no Users menu; opening `#/users` sends them back to the Dashboard
- [ ] Admin: Disable the Staff user, and the Staff session is dropped on its next click
- [ ] "Session ends in…" countdown shows about 6h
- [ ] Account page: change your password, then sign in again with the new one
- [ ] Sign out works

## Notes
- The page may only contact `*.workers.dev` addresses (security policy in `index.html`). If you later put the Worker on your own domain, add that domain to `connect-src` there.

## Local development (optional)
Install Node 20, copy `.env.example` to `.env`, set the address, then `npm install` and `npm run dev`.
