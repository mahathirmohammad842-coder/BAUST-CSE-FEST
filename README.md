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
2. Set the Supabase and (if used) Gemini environment variables in `.env.local`
3. Run the app:
   `npm run dev`

## Supabase setup

The client uses Supabase Auth, Postgres, and private Storage. Browser configuration uses only the project URL and publishable key; never put the database connection string or a service-role key in the frontend or a `VITE_` variable.

1. Copy the Supabase values into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
   ```
2. Apply the schema and row-level security rules:
   ```
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase db push --remote
   ```
   The migration creates profile, announcement, personal notification action, and private attachment-storage tables/policies.
3. In Supabase Authentication → URL Configuration, set the production Site URL and add the Vercel URL to the redirect allow list. Password recovery redirects to the current site origin, so include production and any preview URLs you use. Ensure the Auth email provider and password-reset email template are enabled; configure SMTP if your project requires custom email delivery. Configure email confirmation to match your registration policy.
4. Create and confirm `mahathirmohammad842@gmail.com` in Supabase Authentication → Users. Then run [bootstrap-super-admin.sql](./supabase/bootstrap-super-admin.sql) in the Supabase SQL Editor. It creates or promotes that Auth user's profile as Mahathir Mohammad (Super Admin). It does not create an Auth user or set a password. Keep this operation restricted to project owners; the app does not allow public registration as Organizer, Admin, or Super Admin.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Vercel environment variables for the appropriate deployment environments, then redeploy.

New registrations are created as `Pending Approval`; active staff can approve or reject them from User Approvals. After the first staff user signs in, the app seeds the initial sample notices if the announcements table is empty. Profiles, notices, notification actions, and uploaded notice attachments are then persisted in Supabase. Other prototype data (such as simulated delivery records and user-block audit history) still uses the app's local/demo state.

Attachments use the private `notice-attachments` bucket and signed download URLs. The migration limits uploads to 25 MB and the supported document/image types. The browser-side file checks are not malware scanning.

## User and role management

The Supabase **Users** directory displays actual profiles rather than demo identities. The **Super Admin** can promote another active account (except another Super Admin or their own account) to **Admin** from **Profile Management → View → Promote to Admin**. The target must first have a Supabase Auth account and an active profile; new people can register with an eligible non-admin role and be approved before promotion. The promotion is enforced by a database RPC that only an active Super Admin can call. It does not create Auth users or set passwords; use Supabase Auth invitations for new accounts.

Active staff can re-approve a rejected registration from **User Approvals**. Active Super Admins can also move rejected registrations to the reversible **Trash** filter and restore them later. Trash is a soft-delete of the profile record; it does not delete the Supabase Auth user. Apply the latest Supabase migrations with `npx supabase db push --remote` to enable this workflow.

Timed and permanent blocks, block reasons, notes, and history still use browser-local prototype state. They are not a production security boundary and do not disable backend/API access.

## Role-based profiles

Every signed-in role can open **My Profile** to update their photo, name, phone, department, institution, biography, social links, password, and notification preferences. Profiles include completion progress, account status, verification, activity, and sign-in history. The sign-in page includes **Forgot password?** for Supabase email recovery; users follow the emailed link to set a new password. Organizers and Super Admins can manage other profiles, including verification, edits, suspension, blocks, and password resets; Admins can view and verify profiles only. Admin and Super Admin are not public registration roles.

Role permissions follow the assigned Supabase profile role: the Organizer receives event-workspace access, while the Super Admin receives cross-profile administration. Supabase login uses Auth accounts only; demo credentials are not accepted.

When Supabase is configured, account passwords are managed by Supabase Auth and profile fields/preferences are synchronized with the RLS-protected profile table. The local demo-only sign-in and PBKDF2 credential behavior is used only when Supabase environment variables are absent.

## Notice attachments

The Create Notice composer accepts up to five PDF, Word, Excel, PowerPoint, JPG/JPEG, PNG, WebP, ZIP, or TXT files (10 MB per file, 25 MB total). It provides drag-and-drop and browse upload, local import progress, file-type/size/signature checks, image/PDF/text previews, open/download actions, and per-channel attachment options for In-App, Email, and Push notifications. Attendee attachment opens and downloads update the notice's local view and download counters.

Attachments are held as data URLs in the current app session and are not uploaded to a server or persisted after a reload. Browser checks are not antivirus scanning; secure hosted download links, malware scanning, durable analytics, and real Email/Push attachment delivery require a backend upload and notification service.
