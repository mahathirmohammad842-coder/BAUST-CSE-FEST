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

The Organizer-only **Users** page lists demo accounts and registration requests, with search, role/status filters, confirmed deletion, and permanent or timed blocks. Blocks can use preset durations or a custom expiry, include a reason and admin note, and are tracked in the **Blocked Users** audit view with live countdowns, early unblocking, expiry changes, and history. Blocking signs the user out immediately and prevents future sign-in in this frontend prototype. User data and audit events are stored in the current browser's local storage; there is no server-side API or shared database, so this UI is not a production security boundary and does not disable backend/API access.

## Role-based profiles

Every signed-in role can open **My Profile** to update their photo, name, phone, department, institution, biography, social links, password, and notification preferences. Profiles include completion progress, account status, verification, activity, and sign-in history. Organizers and Super Admins can manage other profiles, including verification, edits, suspension, blocks, and password resets; Admins can view and verify profiles only. Admin and Super Admin demo accounts are available from the sign-in form and are not public registration roles.

The demo Organizer is Sajid Rahman and the demo Super Admin is Mahathir Mohammad. Role permissions follow the assigned role: the Organizer receives event-workspace access, while the Super Admin receives cross-profile administration. Existing browser-stored profile data, credentials, and audit history are migrated with the corresponding account identity.

Profile data, audit history, sign-in history, and password credentials are stored in browser local storage. Passwords use PBKDF2 hashing in this prototype, but there is no server-side identity provider, authorization boundary, or shared database; do not use this implementation to protect production accounts or sensitive data.

## Notice attachments

The Create Notice composer accepts up to five PDF, Word, Excel, PowerPoint, JPG/JPEG, PNG, WebP, ZIP, or TXT files (10 MB per file, 25 MB total). It provides drag-and-drop and browse upload, local import progress, file-type/size/signature checks, image/PDF/text previews, open/download actions, and per-channel attachment options for In-App, Email, and Push notifications. Attendee attachment opens and downloads update the notice's local view and download counters.

Attachments are held as data URLs in the current app session and are not uploaded to a server or persisted after a reload. Browser checks are not antivirus scanning; secure hosted download links, malware scanning, durable analytics, and real Email/Push attachment delivery require a backend upload and notification service.
