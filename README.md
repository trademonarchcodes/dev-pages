# DEVPAGES

**Your domain. Your pages. Your choice.**

DEVPAGES helps customers choose and manage an exact `name.pages.dev` address through their own Cloudflare account. A suggested name is never treated as reserved, and DEVPAGES never silently adds random characters.

## Current product scope

- Public pages: Home, Find a name, Pricing, About, Help and Reviews.
- Customer account: Supabase email/password authentication, verified-email flow, password recovery and a private dashboard.
- Hosting connection: customers authorise their own Cloudflare account with a limited API token; DEVPAGES encrypts the token at rest.
- Name check: checks whether an exact Pages project name already exists in the customer's connected Cloudflare account. This is account-scoped only; Cloudflare performs the final global availability check when a project is created.
- Admin console: server-side role checks and customer/platform summaries.

## Architecture

- **Cloudflare Pages** serves the static site and Pages Functions.
- **Supabase Auth** handles registration, email verification, login and password recovery. The browser calls the Supabase Auth REST API directly; there is no Firebase SDK and no remote ES-module CDN dependency in the auth flow.
- **Cloudflare D1** stores DEVPAGES customer records, server sessions, hosting connections, sites, orders, payments and audit events. D1 remains in place deliberately; the Supabase project is currently the authentication provider, not the application-data database.
- Cloudflare API tokens supplied by customers are encrypted with AES-GCM using the Pages secret `TOKEN_ENCRYPTION_KEY`. Tokens are never returned to the browser.

## Required production configuration

1. Supabase Auth Site URL: `https://devpagesdomain.pages.dev`.
2. Supabase redirect allow-list must include the production login and password-reset URLs.
3. Configure custom SMTP in Supabase before opening registration to the public. Supabase's default SMTP service is restricted to approved project-team email addresses and is not a production email service.
4. Cloudflare Pages production bindings: `DEVPAGES_DB` and the secrets `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`. `ADMIN_EMAIL` identifies the administrator mailbox.
5. After SMTP is configured, test registration, email verification, login, logout and password recovery using an ordinary non-team email address.

Never put Supabase secret/service-role keys, Cloudflare API tokens, payment keys or cryptographic secrets in frontend files or GitHub.

## Not launched yet

Website project creation/deployment, subscription billing, Paystack checkout, automated renewals and paid registrar purchases remain disabled. The planned Pages.dev offer is free during the launch promotion; after the promotion, the intended price is $10 one-time address setup plus $3 monthly service. Payment collection is not active.

DEVPAGES currently supports `name.pages.dev` only. It does not sell or register .com, .net or other custom domains.

## Deployment

- Repository: `trademonarchcodes/dev-pages`
- Production branch: `main`
- Build command: none
- Output directory: repository root
- Production URL: https://devpagesdomain.pages.dev

Do not delete or recreate the production D1 database. Existing user, hosting, order and audit relationships depend on its current schema.

## Security principles

- Never ask customers for their Cloudflare passwords.
- Explain the Cloudflare authorisation clearly and request only the required Pages permission.
- Verify Supabase access tokens on the server before creating a DEVPAGES session.
- Keep the DEVPAGES session cookie HttpOnly, Secure and SameSite=Lax.
- Enforce user ownership in every customer API query and enforce admin roles on the server.
- Encrypt customer Cloudflare tokens at rest and never return them to the browser.
- Verify payment webhooks server-side before changing order or subscription state.
- Do not claim a Pages name is reserved or globally available until Cloudflare confirms it during project creation.
