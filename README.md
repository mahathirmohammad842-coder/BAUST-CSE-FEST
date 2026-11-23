<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f6477fb1-e20d-471a-a45e-d0e5b66983dd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Organizer user management

The Organizer-only **Users** page lists demo accounts and registration requests, with search, role/status filters, confirmed deletion, and temporary one-hour user blocks. Blocking signs the user out immediately, prevents sign-in until the block expires, and can be reversed early with **Unblock**. The Organizer administrator account is protected. In this frontend prototype, user records and access changes are stored in the current browser's local storage; use a backend for shared, production account management.
