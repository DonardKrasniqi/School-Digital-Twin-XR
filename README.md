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
| WASD | Move |
| Mouse | Look (click canvas to lock pointer) |
| `1` | Overview camera |
| `2` | Walk inside |
| `M` | Toggle minimap / compass |
| Blue pads | Teleport |
| Gold spheres | Room info |
| VR button | Enter VR |

## Team roles (from project plan)

1. **Reality capture** — Polycam scan, Blender cleanup, GLB export  
2. **WebXR** — A-Frame scene, loading, collision, teleport  
3. **Experience** — Spatial audio, HUD, proximity zones, info markers  
4. **DevOps** — Repo layout, CI deploy, performance QA  

## Deploy

Pushes to `main` deploy the repo root as a static site via GitHub Actions (configure Netlify or Vercel secrets if needed).
