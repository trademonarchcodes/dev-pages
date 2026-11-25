# DEVPAGES

DEVPAGES is a platform whose primary launch offer is a free Cloudflare Pages subdomain (name.pages.dev), with optional paid custom-domain discovery and future website management.

## Repository status

The initial foundation has been committed:
- Responsive landing page with a dark electric-blue visual system
- Mobile navigation and launch countdown
- Pricing presentation for the announced launch offer
- Client-side brand-name suggestions for .com, .net, .org and .io
- Server-side Cloudflare Registrar API availability and live USD pricing when registrar credentials are configured; DEVPAGES adds a $3 fee to the registrar's registration price
- RDAP-only fallback is clearly labelled as indicative and never presented as guaranteed availability
- Pages Function health endpoint
- Initial D1 relational schema for users, hosting connections, sites, subscriptions, payments and audit events

## Production features still to implement and verify

- Secure customer registration, login and email verification
- Registrar-grade availability confirmation and domain registration/checkout
- Cloudflare OAuth application registration and customer consent flow
- Secure token encryption, rotation and revocation
- Customer-owned Cloudflare Pages project creation and deployment
- Payment gateway integration and verified webhooks
- Subscription renewal, expiry, suspension and reactivation automation
- Customer portal and private administrator dashboard
- Abuse prevention, audit review, backups and operational monitoring

## Deployment

The landing page is static HTML, CSS and JavaScript. The health endpoint uses the Cloudflare Pages Functions convention. Deploy from the main branch with the repository root as the build output directory and no build command.

Production deployment target: https://devpagesdomain.pages.dev. Verify the latest Cloudflare deployment after each main-branch commit.

The name checker supports .com, .net, .org and .io. For live availability and pricing, configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_REGISTRAR_API_TOKEN as Cloudflare Pages environment variables. The token must have the required Cloudflare Registrar permissions. The backend adds the fixed $3 DEVPAGES fee to the returned first-year registration price and displays the registrar renewal price plus $3 as an estimate only. Without the token, the checker falls back to RDAP and labels results as indicative, without showing a purchase price. Always re-check availability and price immediately before registration. Cloudflare's Registrar API is currently beta; verify supported extensions and lifecycle operations before enabling paid checkout. Real purchase checkout still requires payment integration, durable order storage, and verified webhook handling. Before production use, create and bind the D1 database, apply the SQL migration, configure required secrets and test all authentication, payment and hosting flows.

## Security rules

- Never ask customers for Cloudflare passwords.
- Use official authorization with clear consent.
- Keep provider tokens and payment secrets server-side; encrypt tokens at rest.
- Verify payment events server-side before changing subscription status.
- Apply least-privilege permissions and audit administrator actions.
- Never suspend or delete a site based only on an unverified browser-side payment status.

## Primary offer: Pages.dev subdomains

The primary advertised DEVPAGES offer is a `name.pages.dev` Cloudflare Pages subdomain, free during the launch promotion. This is not a separately registered domain and cannot be checked through RDAP or purchased from a registrar. Cloudflare Pages project names are globally unique; a suggested name is not reserved. The platform still needs a secure Cloudflare authorization and Pages project-provisioning workflow to verify availability and create customer projects. Optional `.com`, `.net`, `.org` and `.io` registrations are separate paid offerings and are not included in the Pages.dev promotion.
