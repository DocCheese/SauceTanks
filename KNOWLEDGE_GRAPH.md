# Knowledge Graph

```mermaid
graph TD
  Tank["Tank Entity"] --> Hull["Hull Mesh"]
  Tank --> Turret["Turret Group"]
  Turret --> Cannon["Cannon Pivot"]
  Tank --> Treads["Tread Meshes"]
  Tank --> CameraModes["Camera Modes"]
  CameraModes --> Driver["Driver View"]
  CameraModes --> Gunner["Gunner View"]
  CameraModes --> Commander["Commander View"]

  Terrain["Shader Terrain"] --> HeightFunc["getHeightAt()"]
  HeightFunc --> Collision["Grounding + Collision"]
  Terrain --> BiomeColors["Height Color Bands"]

  SVGTextures["SVG Textures"] --> HullTex["Hull Texture"]
  SVGTextures --> TurretTex["Turret Texture"]
  SVGTextures --> TreadTex["Tread Texture"]

  Input["Input System"] --> Drive["Drive Controls"]
  Input --> Aim["Turret + Cannon Aiming"]
  Aim --> Fire["Projectile Firing"]

  HUD["HUD + Mini-map"] --> CameraModes
  HUD --> Input
```

## Node Notes
- **Tank Entity** bundles meshes, camera tracking, and movement physics.
- **Shader Terrain** provides both visuals and the authoritative height data for collision.
- **SVG Textures** are generated from inline SVG strings to keep styling editable.
- **HUD + Mini-map** communicate role changes and positional awareness.
