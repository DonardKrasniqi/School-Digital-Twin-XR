# School Digital Twin (WebXR)

Immersive virtual campus tour built with **A-Frame** and a scanned **GLB** school model. Explore on desktop (WASD + mouse), mobile, or VR headsets.

## Project structure

```
├── index.html              # Main WebXR scene entry
├── src/main.js             # Tour logic, HUD, audio, zones
├── styles/main.css         # 2D overlays (panel, HUD, loading)
├── assets/
│   ├── models/school.glb   # Optimized campus scan (< 15 MB)
│   └── audio/              # Spatial ambience & zone sounds
├── docs/
│   └── Virtual-School-Plan.docx
└── .github/workflows/      # Static deploy on push
```

Legacy folders (`NextGen Lab`, `Digital Campus Soundscape`) can be removed after verifying the root app works.

## Run locally

Requires a local HTTP server (browsers block `file://` for 3D assets).

```bash
npm install
npm start
```

Then open **http://localhost:3000**

Or without npm:

```bash
npx --yes serve -l 3000
```

## Controls

| Input | Action |
|--------|--------|
| WASD | Move (inside room walls) |
| Mouse | Look around |
| `M` | Toggle minimap |
| `B` | Ring bell |
| Blue pads | Jump to spot in room |
| Panel buttons | Bell, hallway ambience |
| VR button | Enter VR (after Enter classroom) |

## Deploy on Vercel

This is a **static site** (no build step). `index.html` is at the repo root.

### Option A — Import from GitHub (recommended)

1. Push this repo to GitHub (see below if push fails).
2. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
3. **Import** `DonardKrasniqi/School-Digital-Twin-XR`.
4. Leave defaults:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command:** (empty)
   - **Output Directory:** `./`
5. Click **Deploy**. Vercel gives you a URL like `https://school-digital-twin-xr.vercel.app`.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Follow prompts; use the project root. For production:

```bash
vercel --prod
```

`vercel.json` in this repo sets the output directory and caches the GLB model.

## Push to GitHub

```bash
git push origin main
```

If you see `Permission denied`, sign in as **DonardKrasniqi** (repo owner):

```bash
gh auth login
# or update Windows Credential Manager for github.com
```
