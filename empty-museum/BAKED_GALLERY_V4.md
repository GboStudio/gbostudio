# THE UNREAL MUSEUM — V4 baked architecture

## What is actually rendered
The 3D entrance is built with Blender 4.0 + Cycles by
\`blender/bake_entrance.py\`. It contains limestone threshold geometry,
shallow reveals, satin bronze details and a secondary portal that is visible
inside the initial portrait mobile field of view.

The authored meshes are UV-unwrapped as one geometry atlas. Cycles bakes the
**DIFFUSE COLOR + DIRECT + INDIRECT** light contributions into a 1024 px
texture. The exporter embeds that PNG in \`assets/entrance-v4-baked.glb\`.

This is **real baked global-illumination-like diffuse bounce lighting** for
static geometry, not realtime ray tracing, dynamic GI or HDR reflections.
It does not model every museum room. The existing V3 gallery continues to
provide floor, walls, framed works, navigation, inventory and fallback.

## Runtime
\`engine3d.js\` loads \`baked-architecture-v4.js\`, which fetches a small GLB
asynchronously. It draws the baked entrance with one tone-mapped unlit
material, avoiding double-lighting. On network failures, a missing asset,
incompatible WebGL, oversized geometry or invalid embedded texture, V3
remains available without an interrupted visit.

The model is **not collidable**: visitors retain the V3 free navigation and
guided route. Decorative portals must never conceal paid artwork or narrow
the main visitor aisle.

## Validation gates
1. Blender job bakes and exports the actual geometry and a diagnostic view.
2. \`blender/validate_bake.py\` verifies the binary glTF, embedded texture,
   UVs, primitive/vertex budget, and saved preview PNG.
3. \`tests/museum.test.mjs\` verifies the GLB SHA-256 against
   \`assets/entrance-v4-manifest.json\`.
4. Staging Chromium on desktop and portrait mobile must **actually load**
   \`data-museum-lighting="cycles-baked-v4"\`, then test the full visitor
   journey including free movement, guided visit and touch targets.
5. Review fresh staging images against V3. A technically successful loader
   is NOT sufficient if the model is invisible from the visitor's position,
   clips the iPhone HUD or looks overly gold/overexposed.

## Build again
Do not run baking on the public website. Update \`blender/bake_entrance.py\`
on the trusted feature branch. Its GitHub Actions job uses Ubuntu Blender,
generates the PNG/GLB, validates their content and commits the binary only
back to that branch. Merge only after PR checks and visual review.

## Constraints
- No external commercial imagery or unlicensed architecture assets.
- Mobile texture 1024×1024, GLB under 25MB, under 12 draw calls.
- Keep V3 fallback, existing exhibition IDs and nearest-artwork guided resume.
- Preserve accessibility and safe-area mobile controls.
- This is the first baked architectural module, not the final Louvre-level
  entire museum.
