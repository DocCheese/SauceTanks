# Notes

## Build Notes
- Voxel terrain is generated from a seeded height noise function into a filled voxel set, then rendered using an instanced mesh for performance.
- Grounding/collision now sample voxel surface height to keep the tank aligned to destructible terrain.
- Projectile impact checks step along the shell path and carve a spherical hole from the voxel set, triggering a rebuild of the terrain mesh + props.
- SVG textures are converted into canvas-based textures to keep the pipeline GPU-friendly without external assets.
- Pointer lock is required for turret/cannon aiming; click the canvas to lock.
- The skybox is a shader-driven dome tied into the lighting system, which animates a gentle sun path.

## Next Steps
- Add chunked voxel meshing to avoid full rebuilds on every impact.
- Introduce voxel material types (dirt, grass, rock) with distinct visuals and physics.
- Add AI patrol routes and target tracking for the gunner mode.
- Add HUD indicators for ammo, hull health, and turret heading.
