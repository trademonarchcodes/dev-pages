# DEVPAGES

DEVPAGES is a platform whose primary launch offer is a free Cloudflare Pages subdomain (name.pages.dev), with optional paid custom-domain discovery and future website management.

## Implemented foundation

- Responsive dark/electric-blue public website, mobile navigation and launch countdown.
- Production security headers, private API response caching rules and admin-page no-index controls.
- Brand-name suggestions and indicative RDAP checks for .com, .net, .org and .io.
- Customer workspace UI at /account.html and separate administrator console UI at /admin.html.
- Cloudflare Pages Functions for email-code sign-in, session handling, customer dashboard data and role-guarded administrator summaries.
- D1 production database created and bound to the Pages project as DEVPAGES_DB.
- D1 schema applied to production, including users, sessions, one-time codes, hosting connections, sites, subscriptions, payments, domain orders and audit events.
- Admin identity is configured to the verified mailbox devlyonofficial@gmail.com; administrator role is granted only after that mailbox completes email verification.
- No customer can see another customer's rows; dashboard queries are scoped to the authenticated user and admin summaries enforce the admin role server-side.

## Activation dependencies — not yet live

The account backend is deployed, but public sign-in cannot be enabled until the following are configured:
1. A verified sending domain in Cloudflare Email Service (the Cloudflare account currently has no zones/verified sender domain).
2. A Cloudflare API token with Email Sending Write permission, stored as the Pages secret CF_EMAIL_API_TOKEN.
3. A strong random AUTH_PEPPER and SESSION_SECRET, both stored as Pages secrets. Never commit these values to GitHub or send them in chat.
4. EMAIL_FROM set to an address on the verified sending domain.
5. Test email delivery, OTP expiry/attempt limits, session cookies and administrator role before inviting customers.

The health endpoint reports configuration readiness without disclosing secret values. Until email delivery and the two cryptographic secrets are configured, the sign-in API intentionally fails closed.

## Still required for full commercial launch

- Cloudflare OAuth app registration/publisher verification and customer consent for each customer's own Cloudflare account.
- Secure customer Cloudflare OAuth callback, encrypted token storage, revocation and Pages project creation. Customers must see Cloudflare's real authorisation consent; DEVPAGES will not collect Cloudflare passwords.
- Registrar API support validation and actual domain registration purchase flow.
- Paystack onboarding, API secret and verified payment webhooks.
- Domain checkout, registrar cost pass-through + $3 DEVPAGES markup + payment processing fee, receipts and refunds.
- Automated renewals, expiries, service suspension/reactivation, support tools, abuse controls, audit review and backups.

## Deployment

The site deploys from the main branch with repository root as the build output directory and no build command. Production URL: https://devpagesdomain.pages.dev.

The D1 database is already created and the migration has been applied. The Pages project has the production D1 binding DEVPAGES_DB. Do not delete or recreate the database.

## Custom-domain pricing

The intended pricing rule is the registrar's live registration price + a fixed $3 DEVPAGES markup + applicable payment-processing fee. Renewal price is separate and must be displayed before purchase. Never hardcode sample registrar prices. The current RDAP fallback is indicative only and must never be presented as confirmed availability or a purchasable quote.

## Pages.dev offer

The primary advertised offer is a `name.pages.dev` Cloudflare Pages subdomain, free during the launch promotion. This is not a separately registered domain. Cloudflare Pages project names are globally unique; a suggested name is not reserved. A real customer claim must be completed by creating a Pages project in the customer's own authorised Cloudflare account. Optional .com, .net, .org and .io registrations are separate paid services.

## Security rules

- Never ask customers for Cloudflare passwords.
- Use official Cloudflare OAuth consent and explain the provider clearly.
- Keep provider tokens and payment secrets server-side; encrypt tokens at rest.
- Verify payment events server-side before changing order or subscription status.
- Enforce ownership in every API query and admin role checks on the server.
- Never suspend or delete a site based only on an unverified browser-side payment status.
