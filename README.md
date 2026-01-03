# SauceTanks - ThreeJS Tank Game Concept

A first-person tank driving prototype built with Three.js. The focus is on a multi-role tank experience (driver + gunner + commander), SVG-based textures, and voxel terrain with destructible cover.

## Features
- **First-person driving loop** with adjustable camera modes (driver, gunner, commander).
- **Turret + cannon control** via mouse look and firing projectiles.
- **SVG textures rendered in 3D** for hull, turret, and treads.
- **Voxel terrain** with procedural height seeding and instanced mesh rendering.
- **Destructible terrain** that reacts to shell impacts and rebuilds surface props.
- **Nature props** (grass, trees, rocks) scattered across the terrain.
- **Collision-ready voxel sampling** that keeps the tank grounded.
- **Mini-map** toggle for a quick top-down situational view.

## Run locally
Use any static server (needed for ES module imports):

```bash
python -m http.server
```

Open `http://localhost:8000`.

## Controls
- **WASD**: Drive
- **Shift**: Boost
- **Mouse**: Turret + cannon aim (click to lock pointer)
- **Left Click**: Fire (destroys nearby voxels on impact)
- **V**: Cycle camera modes
- **M**: Toggle mini-map

## Project Layout
- `index.html` - App shell + HUD
- `styles.css` - HUD + canvas styling
- `main.js` - Three.js scene, controls, tank logic
- `NOTES.md` - Build notes + future work
- `THOUGHTS.md` - Design thoughts
- `KNOWLEDGE_GRAPH.md` - Relationships between features, systems, and data
