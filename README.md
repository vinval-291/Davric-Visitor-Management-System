# Dav-Ric Group Visitor Management System

Digital visitor registration, signature capture and real-time arrival
notifications for Dav-Ric Group reception. Replaces the paper visitor
logbook.

**The core loop:** the receptionist registers an arrival and captures a
signature, the database routes an alert to the executive's assigned PA,
the PA sends the visitor up, and reception checks them out on the way
past.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 |
| Styling | Tailwind CSS 4 |
| Database, auth, realtime, storage | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Installable app | Web app manifest + hand-written service worker |

---

## Local setup

```bash
npm install
cp .env.example .env      # then fill in the Supabase values
npm run dev
```

`.env` needs at minimum:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

The anon key is safe in the browser. It grants nothing on its own —
Row Level Security is what protects the data. **The `service_role` key
must never appear in this project.**

### Database

Run the migrations in `supabase/migrations/` in numerical order, in the
Supabase SQL Editor. They are written to be safe to re-run.

| File | What it adds |
|---|---|
| `0001_initial_schema.sql` | Tables, triggers, RLS enabled with no policies |
| `0002_rls_policies.sql` | Role helpers, guard triggers, all policies |
| `0003_guard_bootstrap_fix.sql` | Lets trusted server context through the guards |
| `0004_signature_storage.sql` | Private signature bucket and its policies |
| `0005_phone_format.sql` | 11-digit phone constraint |
| `0006_notified_names.sql` | Tells reception who was notified |
| `0007_admission.sql` | The "send up" event |
| `0008_checkout_server_time.sql` | Server-stamped check-out |
| `0009_reports.sql` | Report summary function |
| `0010_audit_logging.sql` | Audit triggers |
| `0011_audit_grants.sql` | Makes audit tampering fail loudly |
| `0012_admission_notification_type.sql` | New notification type — **run on its own** |
| `0013_notify_desk_on_admission.sql` | Alerts reception when a PA sends a visitor up |
| `0014_push_subscriptions.sql` | Devices registered for push |

Then `supabase/seed.sql` for placeholder departments and executives.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run check:db` | Is Supabase reachable and the key valid? |
| `npm run check:schema` | Does any table leak data to an anonymous visitor? |
| `npm run test:security` | Full role-based security suite (29 checks) |
| `npm run icons` | Regenerate app icons from the logo |
| `npm run diagnose:realtime` | Reproduce the PA→reception live update path |
| `npm run vapid` | Generate the Web Push key pair (once, ever) |

`test:security` needs the `TEST_*` credentials in `.env`. See
`.env.example`. **Never put those in Vercel.**

Manual test plan: [TESTING.md](TESTING.md).

---

## Deployment

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR-ORG/davric-vms.git
git push -u origin main
```

### 2. Import into Vercel

New Project → import the repository. Vercel reads `vercel.json`, so the
framework, build command and output directory are already set.

Add two environment variables (Production, Preview and Development):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Optionally `VITE_IDLE_TIMEOUT_MINUTES` (default 30, `0` disables).

**Do not add the `TEST_*` variables.** They are local-only credentials.

### 3. Point Supabase at the deployed URL

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: the production domain
- **Redirect URLs**: add the production domain and the Vercel preview
  pattern

Without this, sign-in works locally but fails in production.

### 4. Confirm the production settings

- **Authentication → Sign In / Providers → Email**: "Allow new users
  to sign up" is **off**. Accounts are created by an administrator.
- Storage → the `signatures` bucket is **private**.
- `npm run check:schema` against the production project.

### 5. Custom domain

Vercel → Settings → Domains → add the Dav-Ric subdomain, then create
the CNAME record with whoever controls DNS. Add the final domain to the
Supabase redirect URLs as well.

---

## Installing it as an app

The app is installable on Android, iPhone/iPad, Windows and macOS. It
runs in its own window with no browser chrome, has its own icon, and
keeps the interface cached so it opens instantly.

**Installation requires HTTPS.** It will not offer to install from
`localhost` over plain HTTP or from a preview build served without TLS,
so test this against the deployed Vercel URL.

| Platform | How |
|---|---|
| Android (Chrome) | Tap **Install app** in the header, or Chrome's "Add to Home screen" prompt |
| Windows / macOS (Chrome, Edge) | **Install app** in the header, or the install icon in the address bar |
| iPhone / iPad | **Safari only.** Share button → *Add to Home Screen*. iOS has never supported an install prompt, so the app shows these steps instead |

Icons are generated from the logo by `npm run icons`. Only the D mark is
used, not the full wordmark: the logo is more than twice as wide as it
is tall, and at the ~60px a home screen actually renders, "GROUP OF
COMPANIES" is an illegible smudge.

### What is cached, and what is not

The service worker (`src/sw.js`) caches the application shell so it
opens instantly and shows its own "no connection" banner instead of a
browser error page.

**It never caches Supabase.** A cached visitor list would show someone
as still on the premises after they left, which is worse than showing
nothing. The app still cannot check anyone in while offline.

Updates are offered, not forced. A silent reload could discard a
half-filled visitor form while someone is standing at the desk, so a
banner appears and the user chooses when to reload.

---

## Notification sounds

Each person sets their own alert under the **🔔** button in the header.
Four built-in tones are synthesised in the browser, or a sound can be
chosen from the device — MP3, WAV, OGG or M4A up to 2 MB.

Custom sounds are stored in IndexedDB **on that device only**. A PA who
uses both a phone and a desktop sets it on each. This is deliberate:
the reception tablet and a personal phone want different volumes, and
one person changing the alert should not change it for everyone.

### When alerts actually reach someone

| App state | Without push | With push enabled |
|---|---|---|
| Open and visible | in-app card and sound | same |
| In another tab, desktop | banner and sound | same |
| **Backgrounded on a phone** | **nothing** | **notification** |
| **Fully closed** | **nothing** | **notification** |

The two "nothing" rows are not bugs. A phone freezes a backgrounded
app within seconds: JavaScript stops, the realtime socket closes, and
no arrival can reach the page. A closed app has no socket at all.
Anything that depends on the page being alive cannot work there.

Web Push is delivered to the operating system instead, which wakes the
service worker with the app shut. It is the only mechanism that
reaches a PA with the phone in their pocket.

Each person turns it on per device under **🔔 → Alert me when the app
is closed**.

**Sound for a push is chosen by the operating system, not by us.** On
Android that is a feature: once push is enabled, the app gets its own
entry under **Settings → Apps → Dav-Ric VMS → Notifications**, where
any system ringtone can be chosen — including the preinstalled ones a
website cannot otherwise reach. The in-app custom sound still applies
while the app is open.

On iPhone push requires the app to be **added to the Home Screen**
(iOS 16.4+). A Safari tab is not eligible.

---

## Enabling push (one-time setup)

### 1. Generate the keys

```bash
npm run vapid
```

Generate **once**. Regenerating invalidates every device already
subscribed.

### 2. Publish the public key

Add to `.env` and to Vercel's environment variables:

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

### 3. Set the Supabase secrets

Dashboard → **Edge Functions → Secrets**, or:

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public key>
supabase secrets set VAPID_PRIVATE_KEY=<private key>
supabase secrets set VAPID_SUBJECT=mailto:admin@davric.com
```

The private key is a credential. It never goes in `.env`, in Vercel,
or in this repository.

### 4. Deploy the function

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy send-push
```

### 5. Run migration `0014`, redeploy the site, and enable it per device

Each person opens **🔔 → Alert me when the app is closed** on every
device they want alerted.

### How the send is triggered

The browser that causes an alert calls the function immediately after
the database has written the notification rows. That browser is online
by definition, so no database webhook is needed.

The division of responsibility matters: the notification **row** is
created by a database trigger and is guaranteed. The push is
best-effort delivery on top. A failed push means a less timely alert,
never a lost one — it is still waiting in the app when it is opened.

---

## Day-to-day operations

### Adding a staff member

1. Supabase dashboard → **Authentication → Users → Add user**, ticking
   *Auto Confirm User*
2. In the app: **Admin → Users** → set their name and role

Account creation stays in the Supabase dashboard deliberately. Creating
users from the app requires the `service_role` key, which bypasses every
security policy and must never reach a browser.

### Assigning a PA to an executive

**Admin → PA assignments.** An executive with no PA is not broken —
their alerts fall back to the active super admins — but the screen
flags it, because somebody at the desk is chasing them.

This mapping is the single most important piece of configuration in the
system. If it is wrong, visitors arrive and nobody is told.

### Someone left without checking out

They stay on the reception screen under "Currently inside", showing the
date they arrived and flagged **Not checked out**. Check them out
normally. Left alone these inflate the occupancy figure and make an
emergency roll call meaningless.

---

## Security model

Enforced in the database, not the interface. The UI decides what is
convenient to show; Row Level Security decides what is possible.

| | Receptionist | PA | Super Admin |
|---|---|---|---|
| Visitor records | all | only their executives' | all |
| Register / check out | yes | no | yes |
| Send a visitor up | no | their executives only | yes |
| Notifications | none | own only | all |
| Departments / executives | read | read | full |
| User roles | no | no | yes |
| Audit log | no | no | read only |
| Signatures | read/write | **no access** | read/write |

Properties worth preserving if you change anything:

- **Visit records are immutable after check-in.** Only admission and
  check-out may change. Only a super admin can amend, and it is logged.
- **Notifications can only be created by a database trigger.** No
  client can forge or suppress a visitor alert.
- **The audit log is append-only.** No UPDATE or DELETE policy, and the
  grants are revoked. Not even a super admin can rewrite it.
- **Timestamps are server-side.** Arrival, admission and departure all
  use the database clock, never the tablet's.
- **Signatures live in a private bucket** and are served through
  60-second signed URLs. Once attached to a visit they cannot be
  replaced or deleted.

---

## Known limitations

1. **No offline capability.** If the internet is down, check-in cannot
   happen; the paper logbook is the agreed fallback. This is why the
   project document asks for backup connectivity at reception.
2. **Accounts are created in the Supabase dashboard**, not in the app.
3. **No audit retention job.** `prune_audit_logs(keep_days)` exists but
   nothing calls it, pending Dav-Ric's retention policy.
4. **Push must be enabled per device**, and on iPhone only after the
   app is added to the Home Screen. Email, SMS and WhatsApp remain
   future enhancements.

---

## Outstanding decisions for Dav-Ric Group

- **Company name**: the logo reads "Dav-Ric Group of Companies"; the
  project document says "Davric Group". This affects the system name
  and the subdomain.
- Real departments, executives, and the executive-to-PA mapping
- Brand colours are sampled from the logo; supply official brand
  guidelines if they differ
- Visitor record retention period
- Whether reception uses a touchscreen tablet or a signature pad
