# THE UNREAL MUSEUM — Security baseline
**Review date:** 2026-11-09  
**Scope:** `empty-museum/` in `GboStudio/gbostudio`.  
**State:** public static demonstration, **not yet production-ready for sales**.

## Verified in repository
- `cloud-config.js` has cloud access disabled; no Supabase credentials are configured in that file.
- `museum-cloud.js` uses the public publishable key solely to read published works.
- `supabase/schema.sql` enables row-level security (RLS) and grants only a restricted read of published works to public database roles.
- `supabase/wall-inventory.sql` includes uniqueness constraints for active wall-slot claims; it must still be applied and tested in the actual Supabase project.
- `commerce-admin.mjs` uses browser-local state, not a privileged server API.
- `commerce-model.mjs` declares pricing, holds and reservations as **simulations without payment**.
- GitHub Actions include browser/availability smoke checks and 3D validation; these are **not** a full vulnerability scan.

## Protections déployées via la PR #38
- Render local reservation fields as DOM text instead of templated HTML.
- Validate local artwork IDs, slots, formats and raster images before rendering; limit user image uploads to supported raster MIME types and 15 MB.
- Run regression tests for these cases on every museum pull request.

## Threats and release gates
1. **Authentication and administrative access — blocking:** before real management, use verified authenticated users, role-based authorizations enforced server-side, MFA for administrators, short sessions and audit logs. Never trust a public URL or hidden interface as access control.
2. **Payments and inventory — blocking:** prices, ownership, expiration, inventory and payment statuses must be verified by a trusted server. Use signed payment webhooks, replay/idempotency protections and database transactions. Do not rely on `localStorage` for actual reservations.
3. **User uploads — blocking:** verify actual file bytes and limits server-side, quarantine uploads, scan for malware, moderate content and ownership rights, strip unwanted metadata and host approved files on controlled origins. For 3D assets, reject external network dependencies and enforce renderer resource budgets.
4. **Supabase production validation — blocking:** inspect live RLS and role privileges, storage policies, RPC grants and privileges after migrations. Never expose service-role keys in client code. Add authorization and hostile-request tests.
5. **Browser and HTTP security — pending external verification:** audit HTTPS redirects and response headers: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, HSTS, permissions policy and framing. If GitHub Pages cannot set required headers, consider a controlled reverse proxy/edge layer. Audit third-party CDN dependencies and content-integrity strategy.
6. **Source security and supply chain:** enable branch protection (required successful tests + review), secret scanning, dependency review, pinned actions/tooling, and explicit approval before merging security-sensitive changes.
7. **Operations and incident response:** centralized security events, failure alerts and retention controls, vulnerability disclosure contact, backup/restore tests and an incident response plan. Scheduled availability checks are not 24/7 threat monitoring.
8. **Privacy and moderation:** establish retention periods, personal-data inventory, GDPR notices and access/deletion workflows before collecting visitor accounts or payments.

## Verification caveat
This audit is based on code and configuration checked in to GitHub, **not** on a successful live penetration test, production headers, deployed Supabase configuration or confirmed live payment integration. A clean repository scan must not be described as a guarantee of security.

## Change control
Keep security changes in a dedicated branch and review the pull request/test results before merging to `main`. Do not disable protective alerts just to silence them.

## Security hardening phase 2 (proposed in PR, not yet deployed)
- Verify PNG/JPEG/WebP file signatures, the claimed MIME, the 15 MB limit and decoded pixel budgets before drawing visitor images onto a canvas.
- Reject oversized glTF buffer views, accessor claims, external asset URIs and cyclic node graphs before invoking the renderer. Bound binary STL triangle declarations. These checks run locally; they do not imply that the file is malware-free.
- Add a restrictive browser Content Security Policy via `<meta http-equiv="Content-Security-Policy">`, limiting script sources and hash-allowing the static import map; remove the inline dialog event handler. GitHub Pages **does not provide all HTTP-only protections through a meta tag** (notably HSTS, frame-ancestors, X-Content-Type-Options). A controlled reverse proxy would be needed for full header security.
- Add repository checks for recognizable accidentally committed credentials, unpinned active Three.js CDN dependencies, disabled real commerce and missing upload security hooks. This heuristic scan does not replace GitHub secret scanning, CodeQL or real CVE advisory feeds.
- Add independent CI on PR, main pushes and daily checks, plus weekly Dependabot suggestions for GitHub Actions.
- Maintain `demo-no-live-payments` until authentication, payment webhooks, moderation and backend inventory are built and reviewed.
- The definitive proof of deployment is successful GitHub Pages plus the live browser check for the exact SHA, **not a passing isolated unit test**.

### Compatibility note: verified CSP exception
- The Cycles-baked GLB uses temporary browser-local `blob:` URLs for its embedded texture payloads. `connect-src blob:` is required by Three.js/GLTFLoader and does **not** authorize arbitrary third-party network origins. A PR browser regression test caught this omission; keep the exception covered by the CI guard.
