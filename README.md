# SauceTanks - ThreeJS Tank Game Concept

A first-person tank driving prototype built with Three.js. The focus is on a multi-role tank experience (driver + gunner + commander), SVG-based textures, and shader-driven terrain with a height-based collision model.

## Features
- **First-person driving loop** with adjustable camera modes (driver, gunner, commander).
- **Turret + cannon control** via mouse look and firing projectiles.
- **SVG textures rendered in 3D** for hull, turret, and treads.
- **Shader terrain** with procedural displacement and height-based material blending.
- **Collision-ready terrain sampling** that keeps the tank grounded.
- **Skybox + lighting system** with a subtle sun cycle for time-of-day mood shifts.
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
- **Left Click**: Fire
- **V**: Cycle camera modes
- **M**: Toggle mini-map

## Project Layout
- `index.html` - App shell + HUD
- `styles.css` - HUD + canvas styling
- `main.js` - Three.js scene, controls, tank logic
- `NOTES.md` - Build notes + future work
- `THOUGHTS.md` - Design thoughts
- `KNOWLEDGE_GRAPH.md` - Relationships between features, systems, and data
