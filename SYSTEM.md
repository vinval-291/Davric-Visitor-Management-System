# How the system works

Dav-Ric Group Visitor Management System — the complete flow, screen by
screen and step by step.

This is the "what happens and why" document. Setup and deployment are
in [README.md](README.md), the test plan in [TESTING.md](TESTING.md),
and running it alongside the paper logbook in [PILOT.md](PILOT.md).

**Live at** https://vms.davricgroup.com

---

## In one paragraph

A visitor arrives at reception. The receptionist registers them and
the visitor signs on the screen. The database stamps the arrival time,
freezes who is being visited onto the record, and creates an alert for
whoever is responsible for that person — their PA, or the executive
themselves. That alert reaches a phone even with the app closed. When
the host is ready, they tap **Send up**, which alerts reception so the
visitor can be told to go up. On the way out, reception checks them
out. Every one of those events is written to an append-only audit log.

---

## The people

| Role | What they do | Where they land |
|---|---|---|
| **Receptionist** | Registers arrivals, checks visitors out | `/reception` |
| **Personal Assistant** | Receives arrival alerts, sends visitors up | `/arrivals` |
| **Executive** | Same, for their own visitors, when no PA covers them | `/arrivals` |
| **Super Admin** | Everything, plus configuration and reports | `/admin` |

A person has exactly one role. Roles are set by an administrator and
cannot be self-assigned — there is no sign-up page.

---

## The visitor journey

### 1. Arrival

The receptionist taps **New Visitor** and fills in:

- Full name (required)
- Phone — 11 digits, formatted as typed, `+234…` converted automatically
- Company
- **Who are you visiting?** (required) — a list grouped by department
- Purpose of visit
- **Signature** (required) — the device is handed to the visitor

Then **Check in**.

**What the browser sends:** name, phone, organisation, purpose,
`executive_id`, the signature's storage path, and who registered it.

**What it does not send:** the arrival time, the status, the
department, or the host's name. Those are filled in by the database.
A browser can lie about the time, and a receptionist under pressure
can pick a mismatched department. Anything that matters as a record is
computed server-side where it cannot be tampered with — which is what
makes the arrival timestamp trustworthy enough to replace the logbook.

### 2. What the database does, in one transaction

| Step | Effect |
|---|---|
| `visitors_snapshot_host` | Copies the executive's name, position and department onto the visit, so history stays truthful after someone changes role or leaves |
| Default `check_in_time` | Server clock, not the tablet's |
| Generated `status` | Derived from whether `check_out_time` is null — it can never disagree |
| `visitors_notify_pa` | Works out who to tell and creates the alert |
| `visitors_audit` | Writes `visitor.check_in` to the audit log |

Because the alert is created by a database trigger rather than by the
app, an arrival cannot be recorded without someone being told. If the
receptionist's tab closed at that exact moment, the alert still exists.

### 3. Who gets told

```
1. the assigned PA(s)                      -- if any
2. otherwise the executive themselves      -- if they have a login
3. otherwise the active super admins       -- so nothing is ever lost
```

An executive who has a PA is *not* also alerted. They have a PA so
that arrivals are filtered for them, and telling both would undo that.

The confirmation screen names who was notified, so the receptionist
can tell the visitor "Mrs Adeyemi has been informed" rather than
guessing.

### 4. The host is alerted

The alert reaches them three ways, depending on where they are:

| Their app | Sound | Notification |
|---|---|---|
| Open and in front of them | yes | no — the card is on screen |
| In another tab or minimised, on a desktop | yes | yes |
| **Backgrounded or closed on a phone** | — | **yes, via push** |

That last row only works where push has been switched on for that
device. Without it a phone freezes the app within seconds of being
backgrounded, the connection closes, and nothing can reach it. The app
detects this and offers the setup guide until it is done.

The alert repeats at a chosen interval while the visitor is still
waiting, so one missed chime during a call is not missed for good.

### 5. Send up

The host taps **Send up**. The database records `admitted_at` and
`admitted_by` using its own clock and its own idea of who is signed in
— the value the browser sends is discarded.

This immediately alerts **reception**: a green banner and a sound, so
the receptionist can tell the waiting visitor to go up without being
asked. They tap **Told them** to dismiss it.

Admission happens once. It cannot be un-sent or re-stamped.

### 6. Check out

Reception finds the visitor and taps **Check out**. The departure time
is stamped by the server. `visit_duration` and `wait_duration` are
generated columns, so they can never drift from the timestamps they
come from.

A visitor cannot be checked out twice.

---

## The screens

### Reception — `/reception`

The live view of everyone on the premises.

**Three counts, deliberately not four:**

- **Inside now** — everyone without a check-out, from *any* day, with
  "includes N still waiting to go up" underneath
- **Arrived today**
- **Left today**

Waiting used to sit beside Inside as though they were separate groups.
Everyone waiting is also inside, so the numbers looked like they should
add up and did not. **Inside** can also exceed **Arrived today**,
because it counts people still on site from earlier days.

**Anyone still inside from a previous day** is flagged "Not checked
out" with the date they arrived, and a notice explains why the counts
differ. These are almost always a forgotten check-out, and left alone
they make the occupancy figure — and any emergency roll call —
fiction.

The list filters by Inside / Waiting / Arrived today / Left today, and
searches by name, company, host, or phone. Phone search matches
whether or not the receptionist typed spaces, because numbers are
stored as bare digits.

On phones and tablets the list is cards; on desktop it is a table.

### New visitor — `/reception/new`

The form above. Every control is at least 48px tall: a receptionist is
usually standing, tapping one-handed while talking to the visitor.

The signature pad uses `touch-action: none`, pointer events, and
device-pixel scaling. Without the first of those the page scrolls under
the visitor's finger and the signature is lost.

### Arrivals — `/arrivals`

Used by PAs and by executives without a PA. Shows waiting, unread and
total counts, then a card per alert with the visitor, their company,
who they are here to see, the purpose, and a waiting time that climbs
on its own.

**Send up** and **Mark as read** are the only actions.

An executive whose account has not been linked to their entry in the
staff list sees a panel saying exactly that, and who to ask — rather
than an empty screen.

### History — `/history`

Date range, executive, department, status, and free-text search, all
filtered in the database rather than the browser. Summary figures
include **average wait** and **average visit**. CSV export covers the
whole filtered set, not just the current page.

**Average wait** — arrival to being sent up — is the number worth
watching. The paper logbook could never produce it.

### Admin — `/admin`

Five tabs:

- **PA assignments** — the mapping the whole system runs on. Flags any
  active executive with neither a PA nor a login of their own
- **Executives** — add, deactivate, set department, and link a login
- **Departments**
- **Users** — names, roles, activation, and send a password reset
- **Audit activity** — every check-in, admission, check-out, role
  change and PA reassignment

Deactivating is almost always better than deleting: a deactivated
executive disappears from reception's picker while past visits keep
their name.

---

## What is recorded

| Table | Holds |
|---|---|
| `profiles` | Name, role, department, active flag — one per login |
| `departments` | |
| `executives` | The people a visitor can ask for, and their optional login |
| `executive_assignments` | Which PA covers which executive |
| `visitors` | The visit record |
| `notifications` | Alerts, and whether they were read |
| `push_subscriptions` | One row per device that can be alerted |
| `audit_logs` | Append-only history of everything that matters |

A visit record keeps both a foreign key to the executive **and** a
frozen copy of their name, position and department. The key makes
reporting possible; the copy keeps history honest when someone is
promoted, moves department, or leaves.

Signatures live in a private storage bucket, not in the database row.
They are served through 60-second signed URLs, so there is no
permanent link to leak.

---

## What the system will not allow

Enforced in the database, so it holds regardless of what the interface
does — or what someone types into a browser console.

**A visit record is evidence.** After check-in, the name, phone,
company, purpose, host, signature and arrival time cannot be changed.
Only admission and check-out may happen. A super admin can amend a
genuine mistake, and the change is written to the audit log with the
before and after.

**Notifications cannot be forged or suppressed.** There is no policy
allowing anyone to create one; they exist only as the output of a
trigger.

**The audit log cannot be rewritten.** No update or delete policy, and
the privileges are revoked besides. Not even a super admin can edit an
entry through the API.

**Nobody promotes themselves.** Role, department and active status can
only be changed by a super admin, checked in a trigger rather than
left to the interface.

**A PA sees only their executives' visitors.** Not hidden in the UI —
absent from the query result.

**Timestamps are the server's.** Arrival, admission and departure all
use the database clock. A reception tablet with a drifting clock
cannot produce a wrong visit duration.

`npm run test:security` checks all of this against the live API as
each role, the way a browser would. 29 checks.

---

## Accounts and passwords

**Creating an account** is two steps, and the first is deliberately
outside the app:

1. Supabase dashboard → Authentication → Users → **Add user**, ticking
   *Auto Confirm User*
2. In the app, **Admin → Users** → set their name and role

Doing step 1 from inside the app would require a key that bypasses
every security policy in the system. That key must never reach a
browser, so the two-minute manual step stays.

**Passwords** can be changed three ways: *Forgot your password?* on the
sign-in page, the **👤** account button when signed in, or **Reset
password** on the admin user list. Changing one while signed in
re-checks the current password first — the reception tablet sits
unattended on a counter.

**Everyone needs their own account.** Every check-in is attributed to
whoever registered it, and a shared login makes that attribution
worthless.

---

## Alerts, per device

Each person sets these up on **every device they use**, because a
subscription belongs to a device and not to a person.

**🔔 → Set up alerts** walks through it in four steps, each detecting
its own state:

1. Install the app — required on iPhone, optional elsewhere
2. Allow notifications
3. Turn on alerts for this device
4. Send a real test alert

The guide opens by itself the first time someone signs in on a device
that cannot yet receive alerts, and a banner offers it afterwards.

Sound, volume and repeat interval are per device too — the reception
tablet and a PA's phone want different settings. A sound file from the
device can be used instead of the built-in tones.

For a **closed** app the operating system chooses the sound. On Android
that means any system ringtone can be picked, under Settings → Apps →
Dav-Ric VMS → Notifications.

---

## When things go wrong

**No internet.** A black bar appears across the top and check-in is
impossible. Use the paper logbook; nobody waits for the network. The
app itself still loads, because its interface is cached — but it never
caches visitor data, since a stale list showing someone as still on
the premises is worse than showing nothing.

**A host did not get an alert.** In order: is push switched on for
*that* device; is Do Not Disturb on; is battery optimisation
restricting the app; is the PA actually assigned to that executive.
`npm run diagnose:push` says whether the alert left the server, which
separates a delivery problem from a mapping one.

**Someone left without being checked out.** They appear under **Inside
now**, flagged, with the date they arrived. Check them out normally.

**Somebody is locked out.** Send a reset from Admin → Users, or set a
password directly in the Supabase dashboard.

**A new version is deployed.** A banner offers it rather than reloading
by itself, which would discard a half-filled visitor form.

---

## Maintenance

| Task | How |
|---|---|
| Check nothing is publicly readable | `npm run check:schema` |
| Full role-based security suite | `npm run test:security` |
| Verify the PA→reception live path | `npm run diagnose:realtime` |
| Verify push end to end | `npm run diagnose:push` |
| Verify email | `npm run test:smtp` |

**Nothing prunes old records.** `prune_audit_logs(keep_days)` exists
but is never called, pending Dav-Ric's retention policy. Visit records
are kept indefinitely.

---

## Known limits

1. **No offline check-in.** The paper logbook is the agreed fallback.
2. **Accounts are created in the Supabase dashboard**, not in the app.
3. **Push must be enabled per device**, and on iPhone only after the
   app is added to the Home Screen.
4. **The push is sent by the browser that caused the alert.** If that
   device loses its connection in the moment between the check-in
   saving and the push being sent, the alert still waits in the app but
   arrives late. The record is never lost — only the timeliness.
5. **DKIM is not yet configured**, so some email will land in spam.
