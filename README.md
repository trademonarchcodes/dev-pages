# DEVPAGES

**Your domain. Your pages. Your choice.**

DEVPAGES is being rebuilt around discovering and using a memorable `name.pages.dev` address.

## Current public preview

- Home
- Find a name
- Pricing
- About
- Help
- Reviews

The name page currently validates the format of a proposed Pages project name only. It does not check Cloudflare availability, reserve a name, or create a project. Cloudflare makes the final availability decision when a Pages project is created.

## Clean restart

The previous customer login, sign-up, password recovery, account dashboard, admin console, Cloudflare account-linking wizard, and their authentication-dependent API routes have been removed from the website code.

There is currently no customer account system, sign-in session, hosting connection, website deployment flow, or payment checkout in the public site. These features will be rebuilt separately.

This repository cleanup does not delete the existing Supabase project, Cloudflare D1 database, Cloudflare Pages settings, secrets, or any external records/tokens. Those infrastructure resources are left untouched.

## Architecture

- Cloudflare Pages serves the public static website.
- `app.js` handles navigation, public name-format validation, and shared reviews.
- No customer authentication or hosting-management API is currently deployed from this repository.

## Not active

Customer accounts, Cloudflare account linking, automated Pages project creation, subscriptions, Paystack checkout, and registrar purchases are not active.

DEVPAGES supports the `.pages.dev` naming concept only. It does not currently sell or register .com, .net, or other custom domains.

## Deployment

- Repository: `trademonarchcodes/dev-pages`
- Production branch: `main`
- Build command: none
- Output directory: repository root
- Production URL: https://devpagesdomain.pages.dev

## Safety

Never ask customers for their Cloudflare passwords or API tokens. Do not claim a project name is available or reserved based only on a local format check.
