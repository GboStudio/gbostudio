# THE UNREAL MUSEUM — commercial exhibition architecture (proposal)

**Status:** product concept and technical prototype, not a live purchase or inventory reservation system.

## Three complementary products

- **Cadre individuel** — one existing wall slot; existing demo's formats 20×30 to 100×40 cm; baseline durations 12 months.
- **Mur privatif** — exclusive use of **three adjacent bays on the same side** of a six-bay gallery segment (approx. 10.5 linear metres, excluding architectural margins); annual license to an exhibition surface. Creator may display 1 panoramic composition or a curated triptych. Do not advertise this as freehold property or a permanent right.
- **Installation 3D au sol / suspendue** — distinct, scarce placements; conditions and expiry dates specific to these media.

## Inventory contract

Existing 2D demo slots are alternating left/right, with four opening partner slots. A six-bay module is `[6n ... 6n+5]`; a saleable segment per side is:
- left: `[6n,6n+2,6n+4]`
- right: `[6n+1,6n+3,6n+5]`.

The first module is NOT whole-wall saleable because partner slots 0–3 are permanently reserved. A wall section is available only if:
1. every constituent bay is unoccupied,
2. no overlapping whole-wall reservation is active, and
3. none of the constituent bays is reserved for partners or otherwise blocked.

After a wall is reserved, its three bay IDs MUST be removed atomically from frame availability. Conversely, reserving any constituent frame must prevent selling the entire section. **Do not rely on client localStorage for this check.** The backend needs transactional or database-enforced exclusive inventory.

## What the customer owns

A time-bound **right to exhibit digital media** under a non-exclusive platform content licence, with exclusive placement during the purchased period — not real estate, not an NFT, not unlimited copyright transfer.

If the agreement includes content moderation, acceptable file formats, copyright warranties, AI media disclosure where applicable, removal powers, renewal reminders, end-date handling, and restoration of available inventory.

## Price design (hypotheses, not active offers)

Selling a wall just because it contains three bays does not justify a huge multiple over three frames. First establish visitor traffic and conversion. A limited pilot may test a wall package around **€99–€249 for 12 months**, compared with actual current slot prices and expected demand. This is exploratory and must not be displayed as a payment offer or guaranteed return.

## Admin UI / lifecycle

states: `available -> held -> payment_pending -> moderation_pending -> published -> expired` with `rejected` and `refunded` transitions.

Required: proof of rights, metadata/content moderation, image/GLB security, renewals, VAT-consistent pricing, and customer support. A publishable Supabase key can be included in frontend **only** with verified restrictive RLS. Service-role keys never go in frontend.

## Prototype constraints

V4 marks eligible three-bay surfaces. Selecting one opens information about exclusivity. **No checkout or payment** is implemented. It must remain transparent that this is a demonstration.

## Editorial / brand

Preferred brand: **THE UNREAL MUSEUM**. The current deploy folder remains `/empty-museum/` for compatibility until the migration redirects, canonical URLs, and brand clearance are completed.
