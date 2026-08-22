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
4. **Notifications are in-app only.** Email, SMS and WhatsApp are
   listed as future enhancements in section 19.
