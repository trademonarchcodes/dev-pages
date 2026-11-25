# DEVPAGES

DEVPAGES is a platform for discovering memorable digital names and managing website hosting through one customer-facing workspace.

## Repository status

The initial foundation has been committed:
- Responsive landing page with a dark electric-blue visual system
- Mobile navigation and launch countdown
- Pricing presentation for the announced launch offer
- Early-stage name-search interface clearly marked as not yet connected
- Pages Function health endpoint
- Initial D1 relational schema for users, hosting connections, sites, subscriptions, payments and audit events

## Production features still to implement and verify

- Secure customer registration, login and email verification
- Live domain-name suggestions and availability checks
- Cloudflare OAuth application registration and customer consent flow
- Secure token encryption, rotation and revocation
- Customer-owned Cloudflare Pages project creation and deployment
- Payment gateway integration and verified webhooks
- Subscription renewal, expiry, suspension and reactivation automation
- Customer portal and private administrator dashboard
- Abuse prevention, audit review, backups and operational monitoring

## Deployment

The landing page is static HTML, CSS and JavaScript. The health endpoint uses the Cloudflare Pages Functions convention. Deploy from the main branch with the repository root as the build output directory and no build command.

Production deployment is currently available at https://devpagesdomain.pages.dev.

Before production use, create and bind the D1 database, apply the SQL migration, configure required secrets and test all authentication, payment and hosting flows.

## Security rules

- Never ask customers for Cloudflare passwords.
- Use official authorization with clear consent.
- Keep provider tokens and payment secrets server-side; encrypt tokens at rest.
- Verify payment events server-side before changing subscription status.
- Apply least-privilege permissions and audit administrator actions.
- Never suspend or delete a site based only on an unverified browser-side payment status.