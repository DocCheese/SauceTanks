# Notes

## Build Notes
- Terrain displacement is handled in the vertex shader while the JS `getHeightAt` function mirrors the math for collision grounding.
- SVG textures are converted into canvas-based textures to keep the pipeline GPU-friendly without external assets.
- Pointer lock is required for turret/cannon aiming; click the canvas to lock.
- The skybox is an SVG texture mapped to a dome, while lighting still animates a gentle sun path.
- World props are SVG-textured meshes that snap to terrain height every frame for cohesion.

## Next Steps
- Add AI patrol routes and target tracking for the gunner mode.
- Expand terrain types with splat mapping and multi-layer normals.
- Add HUD indicators for ammo, hull health, and turret heading.
- Introduce destructible cover objects that use the same shader palette.
- Add mini-map icons per prop type for clearer tactical scouting.
