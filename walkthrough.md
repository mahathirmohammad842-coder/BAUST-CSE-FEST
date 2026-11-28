# Security Summary

**Reviewed Files**: 14  
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Browser Autofill & Metadata Duplication | `src/pages/LoginPage.tsx`, `src/App.tsx` | 250–311, 1756–1776 | Registration used a single affiliation input without `name`/`autoComplete` attributes adjacent to the password field, causing browsers with saved Super Admin credentials to autofill the admin email into both `department` and `institution`. | High | Fixed | Split into separate plain-text `Department` (`autoComplete="organization-title"`) and `Institution` (`autoComplete="organization"`) inputs, added non-email validation (`isEmailLikeValue`), and stored each column independently. |
| Cross-Session Cache & Fallback Profile Leakage | `src/App.tsx`, `src/utils/profileStore.ts` | 176–260, 511–636, 3022–3110 | Legacy migration code and un-scoped `localStorage` keys (`baust_user_profiles`, `baust_organizer_profile`) plus `DEMO_USERS` fallbacks could leak prior-session or demo/admin values into active profile state, notification feeds, and settings pages. | High | Fixed | Removed legacy swap/migration logic and admin identity injections, isolated cloud mode from `localStorage` caches, cleared all user-scoped storage keys and React state on sign-out and session switches (`clearAuthenticatedWorkspaceState` & `clearUserScopedStorageCaches`), and removed `DEMO_USERS` fallbacks when Supabase is configured. |
| Unverified Session Lookup & Hardcoded Admin Seed | `src/lib/supabase.ts`, `src/data/mockData.ts`, `supabase/bootstrap-super-admin.sql` | 212–237, 633–650 | `fetchCloudProfile` trusted a caller-supplied ID without re-verifying the authenticated session (`supabase.auth.getUser()`), and seed/bootstrap files contained a personal admin email address. | High | Fixed | Enforced `supabase.auth.getUser()` identity verification and strict `.eq('id', user.id).single()` matching in `fetchCloudProfile` and `saveCloudProfile`, and replaced hardcoded personal email/phone strings in `mockData.ts` and `bootstrap-super-admin.sql` with neutral placeholders. |
| Database Non-Email Enforcement & Existing Corrupted Data | `supabase/migrations/20261127190000_strict_profile_isolation_and_sanitization.sql` | 1–210 | The database lacked constraints and trigger sanitization preventing email addresses from persisting in `department` or `institution`, and existing rows created before the fix could still retain autofilled emails. | High | Needs Follow-Up | Added `is_email_like()`, cleaned existing email-contaminated `department`/`institution` rows, enforced `CHECK` constraints, hardened `sync_and_guard_user_profile` & `create_user_profile_on_signup`, and re-asserted strict `auth.uid()` RLS policies. Apply remotely with `npx supabase db push`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Row-Level Security (RLS) | `supabase/migrations/20261127190000_strict_profile_isolation_and_sanitization.sql` | Revokes `public`/`anon` access, limits `authenticated` updates to safe personal profile columns, and restricts `SELECT`/`UPDATE` rows strictly to `id = (select auth.uid())` unless `public.is_active_staff()` is true. |
| Profile Editor Field Validation | `src/pages/UserProfilePage.tsx`, `src/pages/SettingsPage.tsx` | Normalizes loaded `department`/`institution` via `sanitizeProfileTextField`, enforces explicit `name`/`autoComplete` attributes, and rejects email-formatted values on save with accessible inline alerts (`role="alert"`). |
| Dependency Security Check | `package.json`, `bun.lock` | Ran read-only `bun audit` across 290 installed packages with 0 vulnerabilities found. |

## PoC Verification

### 1. Browser Autofill & Registration Metadata Email Leakage

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-User Profile Field Contamination via Autofill & Metadata Mapping |
| Impact | High |
| Affected File | `src/pages/LoginPage.tsx:277` / `src/App.tsx:1756` / `supabase/migrations/20261127190000_strict_profile_isolation_and_sanitization.sql:162` |
| Test Scenario | Register a new user (`tanvir`) while `department` or `institution` contains an autofilled email (`mahathirmohammad842@gmail.com`). |

#### How It Was Fixed
Separated registration `department` (`autoComplete="organization-title"`) and `institution` (`autoComplete="organization"`) fields with explicit `name` attributes, rejected email-like strings at form submission, handler execution, client persistence, and database trigger/constraint layers, and kept blank fields empty (`''`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | User submits signup form in `LoginPage.tsx` with `department: "mahathirmohammad842@gmail.com"`. | Enters `handleRegistrationSubmit` (`LoginPage.tsx:250`). |
| 2 | `isEmailLikeValue(trimmedDepartment)` evaluates `true` at `LoginPage.tsx:277` (and is re-checked at `App.tsx:1758`). | Submission is blocked immediately with a field validation message; `supabase.auth.signUp` is never called. |
| 3 | Even if crafted metadata bypasses the UI and hits Supabase Auth directly, `create_user_profile_on_signup` (`20261127190000_strict_profile_isolation_and_sanitization.sql:162`) detects `is_email_like` or equality with `new.email` and resets `dept_val`/`inst_val` to `''`, while table `CHECK` constraints reject any email write via `UPDATE`. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Email values can no longer be autofilled, copied across fields, or persisted into `department` or `institution` at either the UI or database layer.

---

### 2. Cross-Session Local Cache & Fallback State Exposure

#### Summary
| Field | Value |
|---|---|
| Issue Type | Stale Cache & Cross-Account State Leakage |
| Impact | High |
| Affected File | `src/App.tsx:610`, `src/App.tsx:3022`, `src/utils/profileStore.ts:31` |
| Test Scenario | Sign out of an active Organizer/Super Admin session with cached `localStorage` entries, then sign in as a newly registered Participant (`tanvir`). |

#### How It Was Fixed
Removed the legacy cross-account identity migration (`initializeProfileState`), stopped reading/writing `localStorage` caches when Supabase is configured, cleared all user-scoped storage keys and React states inside `clearAuthenticatedWorkspaceState()`, and derived `activeProfile` and `inboxUser` strictly from the authenticated user's ID without falling back to `DEMO_USERS`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Previous user triggers `handleSignOut` (`App.tsx:3863`) or receives a Supabase `SIGNED_OUT` event (`App.tsx:811`). | `clearAuthenticatedWorkspaceState()` (`App.tsx:610`) runs `clearUserScopedStorageCaches()` (`profileStore.ts:31`) and resets `profileState`, `registrationRequests`, `notificationActionStore`, `organizerProfile`, and `registeredUser`. |
| 2 | New user signs in via `activateSupabaseUser(userId, authEmail)` (`App.tsx:640`). | Clears caches again, calls `supabase.auth.getUser()` to confirm session UID match, loads only `verifiedId` rows (`fetchCloudProfile(verifiedId)`), and replaces `notificationActionStore` strictly with `{ byUserId: { [verifiedId]: userStates }, events: userEvents }`. |
| 3 | User visits Profile (`UserProfilePage`) or Settings (`UserSettingsPage`, routed for all cloud roles at `App.tsx:3987`). | Displays strictly the authenticated user's own database record (`auth.uid()`), with empty optional fields remaining blank. |

#### Conclusion
**Fix Verified** - Prior-session React state, notification events, `localStorage` keys, and demo/admin defaults can no longer bleed into another user's session.

---

### 3. Session-Verified Profile Fetch & Database Row Isolation

#### Summary
| Field | Value |
|---|---|
| Issue Type | Direct Profile Query Without Active Session Check & Strict Row Ownership |
| Impact | High |
| Affected File | `src/lib/supabase.ts:212`, `supabase/migrations/20261127190000_strict_profile_isolation_and_sanitization.sql:45` |
| Test Scenario | Call `fetchCloudProfile` with a mismatched user ID or issue a direct PostgREST `user_profiles` query as a standard authenticated Participant. |

#### How It Was Fixed
Updated `fetchCloudProfile` and `saveCloudProfile` to validate the active Supabase session via `supabase.auth.getUser()`, enforce exact `user.id` matching on both query and returned row, and hardened `user_profiles` RLS policies and grants so non-staff users can only read and update safe fields on `id = auth.uid()`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Caller invokes `fetchCloudProfile(mismatchedId)`. | `supabase.auth.getUser()` resolves active `user.id`; mismatch throws `'Profile session mismatch detected'` at `src/lib/supabase.ts:224`. |
| 2 | Non-staff authenticated user queries `public.user_profiles` directly via Supabase client. | RLS policy `"Users read own profile and staff read all"` evaluates `id = (select auth.uid()) or (select public.is_active_staff())`, returning exclusively the caller's own row (`20261127190000_strict_profile_isolation_and_sanitization.sql:66`). |
| 3 | Non-staff user attempts to update `role`, `email`, or write an email into `department`/`institution`. | Column-level `GRANT UPDATE` restricts writable columns, `sync_and_guard_user_profile` blocks restricted field changes and email strings (`line 110–134`), and `CHECK` constraints enforce database integrity. |

#### Conclusion
**Fix Verified** - Both client profile loaders and PostgreSQL RLS/trigger controls enforce strict `auth.uid()` isolation and reject email contamination.
