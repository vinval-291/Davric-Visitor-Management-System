# Testing — Dav-Ric Group Visitor Management System

Covers section 16 of the project document.

Automated security tests: `npm run test:security`
Anonymous access check: `npm run check:schema`
Database reachability: `npm run check:db`

The checks below are the ones a script cannot make: they need a real
device, two people, or a judgement about whether something *feels*
right at a reception desk.

---

## 1. Reception — the daily workflow

Sign in as the receptionist account.

- [ ] Login succeeds; landing page is Reception
- [ ] **New Visitor** form opens
- [ ] Submitting an empty form shows inline errors and sends nothing
- [ ] Phone rejects fewer than 11 digits
- [ ] Phone accepts `+234...` and converts it to `0...`
- [ ] The executive list is grouped by department
- [ ] Checking in without a signature is refused
- [ ] Check-in succeeds and shows the arrival time
- [ ] The confirmation names the person who was notified
- [ ] The new visitor appears in the reception table without a refresh
- [ ] Counts at the top update
- [ ] Clicking a row opens the detail dialog
- [ ] The signature renders in the dialog
- [ ] Check-out works from both the row button and the dialog
- [ ] A checked-out visitor shows how long they stayed
- [ ] Search matches name, company, host, and phone typed **with spaces**

## 2. Touchscreen — do this on the real device

Nothing here can be verified on a desktop with a mouse. If the
reception device is a tablet, these are the checks that decide whether
the system is usable in practice.

- [ ] Signing with a finger produces a smooth line
- [ ] **The page does not scroll or bounce while signing**
- [ ] A signature crossing the full width of the pad is captured whole
- [ ] Lifting the finger does not clear the signature
- [ ] A single tap leaves a visible dot
- [ ] **Clear signature** empties the pad
- [ ] Every button is comfortable to hit while standing
- [ ] Rotating the device does not break the layout
- [ ] The form is usable with the on-screen keyboard open

## 3. PA — notifications

Two windows, or better, two devices.

- [ ] Login succeeds; landing page is Notifications
- [ ] A visitor registered at reception appears **without refreshing**
- [ ] The chime sounds
- [ ] The alert shows visitor, company, host and arrival time
- [ ] "Waiting" time increases on its own
- [ ] A visitor for an executive this PA does *not* cover never appears
- [ ] **Send up** flips the card to "Sent up" and records the wait
- [ ] The reception screen updates to "Sent up" without refreshing
- [ ] **Mark as read** clears the "New" badge and the unread count
- [ ] Read state survives a page reload
- [ ] Sound toggle survives a page reload

## 4. Admin

- [ ] All five tabs load
- [ ] A department can be added, renamed and deleted
- [ ] An executive can be added, moved between departments, deactivated
- [ ] A deactivated executive disappears from reception's picker
- [ ] Past visits still show a deactivated executive's name
- [ ] A PA can be assigned to an executive
- [ ] A second PA can be assigned; only one can be primary
- [ ] **Make primary** moves the badge
- [ ] Removing every PA shows the fallback warning
- [ ] A visitor for a two-PA executive alerts **both**
- [ ] A user's name and role can be changed
- [ ] You cannot change **your own** role
- [ ] You cannot deactivate **yourself**
- [ ] A deactivated user cannot sign in to a dashboard
- [ ] Audit tab lists check-in, admission, check-out, role and PA changes

## 5. History and reports

- [ ] Date presets change the result set
- [ ] Filtering by executive, department and status works, and combines
- [ ] Search finds a visitor from a previous day
- [ ] Paging works past 50 records
- [ ] Average wait and average visit show sensible values
- [ ] **Export CSV** downloads
- [ ] The CSV opens in Excel with columns intact
- [ ] A company name containing a comma does not split into two columns
- [ ] Non-ASCII characters in names are not mangled

## 6. Security — the negative tests

`npm run test:security` covers the API. These cover the browser.

- [ ] Signed out, visiting `/reception` redirects to login
- [ ] Signed out, visiting `/admin` redirects to login
- [ ] As receptionist, `/admin` bounces back to `/reception`
- [ ] As PA, `/admin` and `/reception` bounce back to `/pa`
- [ ] After sign-out, the browser Back button does not restore a dashboard
- [ ] A deactivated account sees "Account not activated", not a dashboard
- [ ] Idle timeout warns, then signs out
- [ ] Touching the screen during the warning cancels it
- [ ] The signature image URL stops working after about a minute

## 7. Resilience — what happens when things go wrong

The pilot will surface these whether or not you test them first.

- [ ] Turn off wi-fi mid-check-in: a clear error, no silent data loss
- [ ] Reconnect and retry: the check-in completes
- [ ] Turn off wi-fi on the PA screen, check someone in, reconnect:
      the alert is there after reload
- [ ] Two reception devices at once: both see the same visitor list
- [ ] Double-tapping **Check in** does not create two records
- [ ] Refreshing mid-form loses the form, not a partial record

## 8. Data integrity over time

- [ ] A visitor left un-checked-out overnight shows the date, not just
      a time, and is flagged "Not checked out"
- [ ] "Currently inside" counts them
- [ ] They can be checked out the next day
- [ ] Renaming a department does not rewrite past visit records
- [ ] Deleting an executive leaves their name on past visits

## 9. Installable app and alert sounds

Must be done against the **deployed HTTPS URL**. Installation is not
offered over plain HTTP.

- [ ] Android Chrome: **Install app** appears and installs
- [ ] Installed app opens with no browser address bar
- [ ] The icon on the home screen is the D mark, not a white blob
- [ ] Android: the icon is not letterboxed inside a white circle
- [ ] Windows/Edge or Chrome: installs and opens in its own window
- [ ] iPhone Safari: **Install app** shows the Add to Home Screen steps
- [ ] iPhone: added to Home Screen, opens without Safari chrome
- [ ] App shortcuts (long-press the icon) offer New visitor / Alerts
- [ ] Turn off wi-fi and reopen the installed app: it loads and shows
      the black "No internet connection" bar, not a browser error
- [ ] Deploy a change, reopen: the update banner appears, and
      **Update now** reloads into the new version

### Alert sounds

- [ ] 🔔 opens alert settings
- [ ] Each of the four presets plays on **Play**
- [ ] Choosing a preset plays it immediately
- [ ] A sound file can be chosen from the device and plays
- [ ] A file over 2 MB is rejected with a clear message
- [ ] A non-audio file is rejected
- [ ] The custom sound survives a page reload
- [ ] **Remove** clears it and falls back to Chime
- [ ] Volume changes are audible and persist
- [ ] Turning sound off silences a real arrival
- [ ] **Allow notifications** requests permission
- [ ] With the tab hidden, a real arrival raises a system banner
- [ ] With the tab visible, no banner appears (the card is enough)
- [ ] Settings are per device: a second device keeps its own

## 10. Push — alerts to a closed app

Deployed HTTPS only, and each device must be enabled separately under
**🔔 → Alert me when the app is closed**.

- [ ] The toggle turns on without hanging
- [ ] `npm run diagnose:push` lists that device
- [ ] **Close the app completely** (swipe out of recents), have someone
      check a visitor in, and the phone alerts
- [ ] Lock the phone, repeat: it still alerts
- [ ] Tapping the notification opens the app on the right screen, and
      does not open a second copy
- [ ] The PA is alerted only for executives they cover
- [ ] Reception's phone is alerted when a PA sends a visitor up
- [ ] Turning the toggle off stops alerts, and `diagnose:push` drops
      that device
- [ ] Uninstalling the app stops alerts; the next `diagnose:push`
      reports it pruned
- [ ] Android: Settings → Apps → Dav-Ric VMS → Notifications lets a
      system ringtone be chosen
- [ ] iPhone: works only after Add to Home Screen, not in a Safari tab

If `diagnose:push` reports `sent: 1` but the phone shows nothing, the
problem is on the device — notification permission, battery
optimisation, or Do Not Disturb.

---

## Known limitations

Worth stating plainly before the pilot rather than discovering them
during it.

1. **No offline capability.** If the internet is down, check-in cannot
   happen. The agreed fallback is the paper logbook. This is why
   section 13 of the project document asks for backup connectivity.
2. **User accounts are created in the Supabase dashboard**, not in the
   app. Doing it in-app needs a key that bypasses every security
   policy, which must never reach a browser.
3. **No audit retention job.** `prune_audit_logs()` exists but nothing
   calls it. Waiting on Dav-Ric's retention policy.
4. **Push must be enabled on each device**, and on iPhone only after
   the app has been added to the Home Screen. A device that has never
   been enabled receives nothing while the app is closed.
5. **Custom alert sounds are per device**, stored in IndexedDB, and
   apply only while the app is open. The sound for a push to a closed
   app is chosen by the operating system — on Android, under the app's
   own notification settings.
6. **Push is sent by the browser that caused the alert.** If that
   device loses connection in the moment between the check-in saving
   and the push being sent, the alert still waits in the app but
   arrives late. Moving the send to a database webhook would remove
   that gap.
