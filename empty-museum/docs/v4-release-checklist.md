# THE UNREAL MUSEUM — V4 release notes

**Build status:** code committed to GboStudio/gbostudio. Static JavaScript parsing and file-reference checks passed. Browser graphics, network deployment, actual device FPS, payment workflows and Supabase migrations were **not executed or verified** here.

## Included in V4

- New main entrance: `/empty-museum/` links to `/empty-museum/3d.html`.
- 3D museum architecture retains the 38 opening wall bays (four reserved for partners), five floor positions and future ceiling positions.
- Guided tour, free exploration (keyboard/mouse/mobile), resuming position in local storage, mood toggle and quality setting.
- Mur Total: hypothetical whole-side licensing, three bays belonging to the same six-bay 21 m gallery module, with click-through to a nonbinding enquiry.
- Visitor-facing cloud catalogue adapter, disabled by default; only public, approved works when a compatible backend is configured.
- GLB loader path for approved public models; generic geometric sculptures when no GLB is available.
- `supabase/schema.sql`: public read-only approved works.
- `supabase/wall-inventory.sql`: cross-product bay claims, enforcing nonoverlap between frame and Mur Total inventory after migration.

## Before commercial launch

1. Verify name and brand availability, terms and rights to show submitted works. Do not promise permanent ownership of virtual real estate.
2. Configure an actual Supabase project; review and apply SQL migrations; enable `cloud-config.js` only after RLS and access tests.
3. Implement authenticated creator accounts, secure asset uploads, format/file size limits, model sanitisation and a proper moderation dashboard.
4. Implement a transactional backend reservation, hold expiration, payment provider webhooks, refunds, VAT, invoices and annual expiry/renewal.
5. Mark whether a slot is available from the server **before** enabling any buy action. Browser-only availability is never authoritative.
6. Test GLB import on real Chrome/Safari/iPhone/Android, including cross-origin storage CORS, model bounding boxes and hostile uploads.
7. Run browser tests for first-load, failed CDN, slow network, mobile touch gestures, camera collisions, free/auto navigation and saved sessions.
8. Measure FPS, JS bundle size, memory, texture loading and accessible fallback on low-tier phones before declaring a production-quality 3D engine.
9. Test the live domain's deployment and cache invalidation. A GitHub commit alone does not prove the live site is updated.

## Development notes

- Old URL `/empty-museum/` retained for continuity even though user-facing brand is **THE UNREAL MUSEUM**.
- No real payments, confirmed sales, shared user uploads or permanent museum licences are implemented. The product is still a demo.
- Supabase publishable keys may be public **only with correctly validated RLS**; never include service-role/secret keys in browser JS.
- GLB is supported as a model asset reference, not as a working 3D printer file export or automatic artist-upload conversion.
