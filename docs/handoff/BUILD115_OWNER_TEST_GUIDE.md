# Build 115 — ordered verification after TestFlight delivery

This is the next-candidate test plan. It is not a delivery receipt or a record
of device passes. Follow it only when TestFlight offers **1.0.0 (115)** and the
matching release receipt confirms Apple processing and tester availability.
Purchases remain disabled. Public App Store review and launch remain separate.

## 1. Update both devices without removing your data

1. Finish and save any current recording.
2. Open TestFlight → StrideOS and update to **1.0.0 (115)**. Do not uninstall,
   clear storage, or switch to a purchase-QA build.
3. Keep your usual account. Open More → Activity and confirm old workouts remain.
4. Update the paired Watch app too. Open the iPhone Watch app → My Watch →
   StrideOS and let installation finish. Open StrideOS on the Watch once.
5. If either update is unavailable, or history is missing, report that before
   starting a workout. The new Watch startup recovery requires the updated
   phone **and** Watch; an older Watch retains the earlier startup behavior.

## 2. Check access and layout first

1. Open Today. Confirm Weather → Current streak → the remaining cards, with
   even space between cards. Open **Training options** to find the secondary
   goal/archive actions; **View results** stays visible when applicable.
2. Tap Calendar, Running, AI Coach and More. All bottom labels should use the
   same text size. At a section's first page, the top-left house returns to the
   top of Today. A detail screen should still offer Back where appropriate.
3. Open Running. Confirm its idle subtabs are visible and selectable, including
   **Active**. You should be able to reach the quick-run controls without a plan.
4. Open your archived Rome Half Marathon. Expand Weekly recorded totals,
   Archived plan outline, and Activities in this snapshot. Scroll each section;
   text and controls must remain inside the card margins.
5. Read the coverage note: it describes how many saved activities have distance
   and duration, rather than an average. Race results use plain outcome names.
6. Open your profile. Tap the name/username area to edit identity on its own
   page. The photo control changes the photo independently. Existing name and
   visibility settings should remain intact.
7. In Performance Calibration, open the test information controls. Check that
   instructions are readable and can be closed. Do not enter invented test or
   race results to make predictions or badges change.

## 3. Inspect race linking without adding a false result

1. Open a real upcoming or today's named race in Calendar and choose **Record
   this race**, if offered for that incomplete event. Confirm
   the full event name and distance appear in Running. Cancel before starting
   if this is not the race you are about to record.
2. Alternatively open Running → Active → **Race** mode and inspect the
   race-event picker. Leave
   it unselected for an ordinary training run.
3. For an actual race already in your history, open More → Activity → that run
   → **Link to race** (or **Edit race link**). Choose the matching named race.
   Confirm the event and date.
4. Use the true full elapsed finish time or official time, including stops.
   A recorded time is offered only when its start/end provenance is available.
   If the date differs, confirm only when that run really belongs to the race.
5. Save once. Reopen the run and its matching archive; they should show the same
   result and one linked activity. Linking should not duplicate a workout or
   silently change the frozen training totals.
6. If you do not have a genuine race to link now, stop after inspecting the
   selector. Test **Finish race** during a real race or in a separate
   disposable test context, not by inventing a finish in your training history.

You can preselect a race before recording it. When you end that recording, the
app asks whether you finished or stopped early. **Finish race** can use full
elapsed time for the linked result; **Stop race early** must not become a finishing PR.
Official time can be entered later. An ordinary run's distance alone is not proof
that it was a named race.

## 4. Test phone-started Watch recording for at least 20 minutes

Choose a safe route, carry the phone, and wear the updated Watch. This longer
check targets the startup/disconnection report from the previous build.

1. With setup complete and no permission sheet open, leave the Watch on its
   normal clock face; do not first open StrideOS on the Watch for this start.
2. On iPhone, open Running → Active. Start an ordinary outdoor run. Walking pace
   is fine. Note the local start time.
3. Check that the Watch opens/joins the same session. Open it manually if it
   does not, and report that it needed manual opening. Do not start another run.
4. Check heart rate after movement has begun. Permission and sensor conditions
   affect availability; report missing values rather than assuming connection.
5. Lock the phone for several minutes. At about 5, 10 and 20 minutes, check that
   the phone and Watch still refer to the same run and note any missing metrics.
6. Pause from the Watch, confirm the phone pauses, then resume from the Watch.
   Check the lock-screen control too. The header should show the three chevrons.
7. If the Watch loses connection, keep the phone recording. Note the time,
   whether the Watch app stayed open, when metrics stopped/returned, and whether
   the phone app remained open. Do not repeatedly press Start.
8. If StrideOS crashes, use TestFlight's Share option if offered. Reopen the
   phone app, choose **Resume activity** for that still-open session, and report
   the approximate crash time. A successful resume does not make the crash a pass.
9. After at least 20 active minutes in this longer check, repeat the offline-save check:
   enable Airplane Mode, disable Wi-Fi, stop once and wait for **Run saved**.
   If using Watch End, verify that it finishes the same phone session.
10. Open the saved run. Close/reopen the phone app while offline; confirm it is
    still present and no longer prompts to resume. Restore connectivity, wait a
    minute, and confirm one activity. If Health workout-writing was enabled,
    check for one matching StrideOS-written workout at that start time.

Do not force a radio disconnection or change Health permissions mid-run merely
to make this longer test harder. Those scenarios can be checked separately after
the normal start/save path passes. The source startup repair is not an established
explanation or confirmed fix for the previous crash.

## 5. Send this short result sheet

```text
Phone build / Watch app updated:
Usual account and old history intact:
Running Active tab visible / quick run reachable:
Archive expanded sections stay inside cards:
Today layout / navigation / identity page:
Race selector inspected, or genuine linked race tested:
Phone start opened/joined Watch without manual opening:
Local start time / total recording time:
HR present at about 5 / 10 / 20 minutes:
Watch pause / resume / end:
Any disconnect or crash, with approximate local time:
Exactly one saved activity after offline restart/reconnect:
Matching Health workout count and writing permission:
Other issue or screenshot:
```

After these checks, remaining launch acceptance includes actual signup/email
confirmation, deletion of an explicitly identified disposable account, the paid
purchase lifecycle if subscriptions will launch, final genuine screenshots and
binary/reviewer reconciliation, naming clearance, and the owner's public-release
decision. Existing setup and reported passes should not be repeated without a
specific reason; this candidate's changed phone/Watch paths do need acceptance.
