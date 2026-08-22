# Pilot plan — Dav-Ric Group Visitor Management System

Running the digital system alongside the paper visitor logbook, so
that going fully digital is a decision made on evidence rather than
hope.

Covers section 18 of the project document.

**Suggested length: two weeks.** One week is enough to find crashes but
not enough to find habits. Two weeks covers a full cycle of quiet days,
busy days, and at least one person being off.

---

## What the pilot is actually for

Not "does the software work" — testing already answered that. The
pilot answers four questions that no amount of testing can:

1. **Is it faster than the book?** If registering a visitor takes
   longer than writing a line in a logbook, reception will quietly
   stop using it.
2. **Do PAs actually get told?** The whole system exists for this. A
   PA who misses arrivals will go back to reception phoning them.
3. **Does anybody remember to check visitors out?** This is the single
   most likely failure. A forgotten check-out makes the occupancy
   figure wrong, and that figure is what an emergency roll call
   depends on.
4. **What happens when the internet drops?** It will, at least once.

---

## Before day one

Do all of this at least two days before, not on the morning.

### Company data

- [ ] Real departments entered (**Admin → Departments**)
- [ ] Real executives with correct positions (**Admin → Executives**)
- [ ] Placeholder seed executives deleted
- [ ] An account created for every PA
- [ ] **Every executive mapped to their PA** (**Admin → PA assignments**)
- [ ] No active executive shows the "no PA assigned" warning
- [ ] Cover arranged for PAs who will be away — a second PA can be
      assigned to the same executive

The PA mapping is the one to check twice. Everything else being right
does not matter if a visitor's arrival is announced to the wrong
person.

### People and accounts

- [ ] Each receptionist has their **own** account, not a shared one
- [ ] Each PA has their own account
- [ ] Everyone has signed in once and changed their password
- [ ] Roles verified under **Admin → Users**
- [ ] One named person is the system administrator

Individual accounts matter: every check-in is attributed to whoever
registered it. A shared login makes the audit trail worthless, which
removes one of the reasons for leaving the paper book behind.

### Devices

- [ ] Reception device chosen and in place — touchscreen strongly
      preferred, so the visitor signs on the same screen
- [ ] App **installed** on the reception device
- [ ] App installed on each PA's phone
- [ ] Push enabled on every device: **🔔 → Alert me when the app is
      closed**
- [ ] Alert sound and volume set on each device, and audible from
      where that person actually sits
- [ ] Reception device set never to sleep while on mains power
- [ ] Backup internet confirmed working (hotspot or second line)

### Contingency

- [ ] The paper logbook stays on the desk for the whole pilot
- [ ] Reception knows: **if the system is down, use the book** — no
      one waits for the network
- [ ] Everyone knows who to tell when something goes wrong
- [ ] Someone is available to answer questions on day one

---

## Training

Three short sessions. Do them at the desk with the real device, not in
a meeting room with slides.

### Receptionist — 15 minutes

Walk through one real check-in together, then have them do the next
three unaided while you watch and say nothing.

1. Sign in
2. **New Visitor** → name, phone, company
3. **Who are you visiting?** — grouped by department
4. Purpose of visit
5. **Hand the device to the visitor to sign** — this is the part that
   feels unfamiliar, so practise the handover
6. **Check in**
7. Read the confirmation aloud: it names the person who was notified,
   so the visitor can be told "Mrs Adeyemi has been informed"
8. When the green banner appears, tell the visitor they can go up, and
   tap **Told them**
9. When the visitor leaves: find them in the list, **Check out**

Points worth making explicitly:

- The arrival time is recorded automatically and cannot be edited.
  Nobody needs to write a time down.
- A visitor cannot be checked in without a signature.
- Checking out is not optional. It is what keeps "who is in the
  building" true.
- Search finds anyone by name, company, host, or phone.

### Personal assistant — 10 minutes

1. Sign in on their own phone
2. Install the app
3. **🔔 → Alert me when the app is closed** → allow notifications
4. Choose an alert sound and volume they will actually hear
5. Set **Keep sounding while someone waits** — the alert repeats until
   the visitor is sent up
6. Have someone check in a test visitor **while the PA's phone is
   locked and the app is closed**. Let them see it arrive.
7. Tap **Send up**, and show them reception being alerted

Points worth making:

- They see only visitors for the executives they cover.
- **Send up** is what tells reception the visitor may come up. Nothing
  happens until they press it.
- Alerts only reach a device where push has been enabled — so it must
  be done on every phone they use.

### Administrator — 15 minutes

1. Adding and deactivating a user, and changing a role
2. Adding an executive and assigning their PA
3. **Deactivate, do not delete** — a deactivated executive disappears
   from reception's list while past visits keep their name
4. **History** — date ranges, filtering by executive or department,
   CSV export
5. **Audit activity** — what it records and that it cannot be edited
6. Spotting visitors still inside from an earlier day, and clearing them

---

## Running both systems

**The rule: paper first, then digital.** The book remains the official
record for the whole pilot. If the two disagree, the book wins and the
difference gets recorded.

Yes, this is duplicated effort. It is also the only way to know
whether the digital record is complete, and it is exactly what section
18 of the project document asks for.

### Every evening, five minutes

Someone — ideally the receptionist — compares the day:

| Check | Where |
|---|---|
| Number of visitors in the book vs **Arrived today** | Reception screen |
| Anyone in the book but not in the system | Note why |
| Anyone still showing as inside who has left | Check them out, note it |
| Any arrival the PA says they never heard about | Note the time |

Keep this on one sheet of paper. Three columns: date, what happened,
what was expected. It becomes the evidence for the go-live decision.

---

## What to watch in week one

### Day one

Sit at reception for the first hour. Do not help unless asked — watch
where they hesitate. Hesitation is a design problem, not a training
problem, and it is worth writing down.

Watch for:

- Fumbling the device handover for the signature
- Hunting for the right executive in the list
- Forgetting to tap **Check in** after the signature
- Visitors reluctant to sign on a screen

### The whole week

| Watch for | Why it matters | What to do |
|---|---|---|
| **Visitors still inside overnight** | Occupancy figure drifts, roll call becomes fiction | The screen flags them "Not checked out". If it happens daily, check-out needs a prompt |
| **PAs missing arrivals** | The core purpose fails | Confirm push is enabled on that phone and the sound is audible where they sit |
| **Reception falling back to the book** | The strongest signal of all | Ask why the same day, while they remember |
| **Long waits between arrival and Send up** | **History** shows average wait | If it climbs, the PA is not seeing alerts |
| **Wrong person notified** | PA mapping is wrong | Fix in **Admin → PA assignments** |
| **Visitors refusing to sign** | Policy question, not technical | Escalate to HR — do they want signing to be mandatory? |

### The number that will justify this system

**Average wait**, on the History screen — arrival to being sent up.
The paper logbook could never produce it. If it falls over the pilot,
that is the strongest case for going live; if it rises, something in
the notification chain is not working and it is worth finding out
what.

---

## When something goes wrong

### The internet is down

Use the book. Do not wait for the network with a visitor standing
there. The app shows a black bar across the top saying so.

When it returns, decide with HR whether to back-enter the missed
visitors. Back-entering gives complete history but the arrival times
will be wrong, because the system records when the record was created,
not when the visitor arrived. Recording them as book-only is usually
more honest.

### A PA did not get an alert

In order:

1. Is push enabled on **that** phone? **🔔** → does it say **On**?
2. Is the phone's Do Not Disturb on?
3. Is battery optimisation restricting the app? Android often does
   this without telling anyone.
4. Is the PA assigned to that executive? **Admin → PA assignments**
5. Run `npm run diagnose:push` — it will say whether the alert left
   the server, which separates a delivery problem from a mapping one

### Somebody left without being checked out

Find them under **Inside now** — they are flagged "Not checked out"
with the date they arrived. Check them out. Note it in the daily
comparison; if it happens more than twice a week, the process needs a
prompt rather than more reminders.

### Something looks wrong in a record

Only a super admin can amend a visit, and the change is written to the
audit log with what it was before and after. Nothing is quietly
editable, by design.

---

## Deciding to go live

At the end of the pilot, go through this with whoever owns the
decision.

### Ready if

- [ ] Every visitor in the book also appears in the system
- [ ] Reception says it is as fast or faster than writing
- [ ] PAs are hearing arrivals without being phoned
- [ ] Check-outs are happening the same day, most days
- [ ] No unexplained gaps in the daily comparison
- [ ] The internet dropped at least once and the fallback worked
- [ ] Reports answer the questions management actually asks

### Not ready if

- Reception is still reaching for the book out of preference
- PAs are being phoned about arrivals
- Visitors are routinely still inside the next morning
- Anyone is unsure what to do when it fails

### Cutting over

1. Agree the date with HR and management
2. Keep the book on the desk but stop writing in it
3. Review after a week — if the book stays untouched, retire it
4. Store the completed book according to Dav-Ric's retention policy
5. Set the retention period for digital records: `prune_audit_logs()`
   exists but nothing calls it until that decision is made

### If it has to be rolled back

Return to the book. Nothing is lost — the visitor records stay in the
database and remain searchable and exportable. Write down what failed
before the details fade; that list is what a second attempt is built
on.

---

## Still outstanding from the company

From section 12 of the project document:

- **The company name.** The logo reads "Dav-Ric Group of Companies";
  the project document says "Davric Group". This decides the final
  subdomain and is painful to change after people have bookmarked it.
- **Visitor record retention period** — how long visits and audit
  entries are kept.
- **Whether signing is mandatory.** Currently a visitor cannot be
  checked in without signing. If reception meets refusals, this is a
  policy decision, not a technical one.
- **Who may see visitor history and generate reports** — currently
  reception and super admins.
