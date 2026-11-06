# Build 113 — ordered phone and Watch test guide

Follow this order after TestFlight offers **StrideOS 1.0.0 (113)**. Build and
delivery evidence is recorded separately in `BUILD113_RELEASE.md`; this guide
is a test plan, not a record of successful device tests.

Build 113 contains the new fixes and six race-PR badges. Purchases remain off.
The owner explicitly authorized TestFlight delivery after the earlier hold.
Public App Store review and public launch have not been authorized.

## 1. Update safely and check your existing history

1. Finish and save any recording before updating.
2. Open TestFlight → StrideOS. Select **Update** for **1.0.0 (113)**. If an older
   build is selected, open Previous Builds and choose 113. Do not select private
   purchase build 110 or 112 for this test.
3. Update the paired Watch app as well. On iPhone, open Watch → My Watch, find
   StrideOS, and confirm it is installed on the Watch. Give installation time to
   finish, then open StrideOS on the Watch. Do not uninstall the phone app.
4. Open StrideOS on your iPhone using your usual account. Keep that account for
   sections 1–8; a different tester login is not needed.
5. Open More → Activity. Check that your old workouts are present. Open one older
   saved run and confirm its date, duration and distance still make sense.
6. If history is missing or you see the other-account ownership warning, stop
   here and report the screen. Do not reset, clear data or reinstall to bypass it.

**Pass:** 113 installed, Watch app updated, normal account and old history intact.

## 2. Open the previously broken training archive

1. Open More → Settings → Goal archive.
2. Tap **View results: Rome Half Marathon**, the block that previously failed.
3. Confirm the archived results open, with the saved block and training summary,
   rather than “This archive is unavailable…” or “link is incomplete.”
4. Return to the archive list, close StrideOS completely, reopen it, and open the
   same results again.
5. Check the Today **View results** entry too, if it is visible. Both entry paths
   should reach the same existing archive.

Do not recreate the block or re-log its workouts if it still fails. Report the
entry path and a screenshot so its identifier can be investigated safely.

**Pass:** existing archive opens through its available entry points and after restart.

## 3. Check the tour highlights and scrolling

1. Open More → Settings → **Feature Tours** → Today.
2. Use Next through every step. Look for a yellow outline around the feature
   being described. An offscreen target should scroll into view.
3. At Performance Forecast, confirm the highlighted feature is visible. A
   conditional feature may instead explain why it is unavailable.
4. Tap the empty dimmed area outside the card. The tour should close.
5. Replay Today; try Back and the close button.
6. Replay Running and follow any explicit **Open/Go to** action to its subtab.
   The action should navigate without starting or saving a workout.
7. Replay Calendar, Strength and Achievements. Confirm the target matches the
   explanation, the card stays readable and you can reach its buttons.
8. Optionally increase iPhone text size one step and replay one tour, then
   restore your preferred size. Report clipped text or unreachable controls.

Tours can guide supported subtabs; leaving for an unrelated page ends the tour.
A continuous tour across every possible page transition is not promised.

**Pass:** real targets highlighted/revealed, controls readable, dismissal works.

## 4. Check profile names and visibility

1. Open your profile using the person icon on Today. Find **Name & username**.
2. Enter your preferred First name, Last name and Username.
3. Enable **Show my name**, disable **Show my username**, and tap **Save name &
   username**. Wait for the saved confirmation.
4. Check the profile and Today greeting. Your chosen name should appear without
   the username.
5. Return to the editor. Disable the name, enable the username, save, and check
   those same screens again.
6. Disable both, save, and confirm your actual name/username no longer appear
   in those display locations. Hidden fields remain editable in the editor.
7. Restore the combination you want, save, close/reopen StrideOS, and confirm it
   persists.

The username is currently a local display alias, not a globally reserved handle
or an email replacement for sign-in. Earlier messages/shared exports are not
retroactively changed by these switches.

**Pass:** all visibility combinations work and the saved choice survives restart.

## 5. Verify PR layout, a real result, calibration and badge artwork

### A. Inspect the six badges without adding fake races

1. Open More → Achievements and find the personal-record badges.
2. Inspect **800m, 1 Mile, 5K, 10K, Half Marathon and Marathon**. Open their details
   where available; locked badges can remain locked if you have no result.
3. Half Marathon must display **13.1** and Marathon **26.2** on the badge face.
   Check the other four labels and full titles for clipping.
4. For an earned badge, open its Share Studio preview if offered. Check the art,
   title and background; you do not need to publish or send it anywhere.

### B. Record an actual race/time-trial result

1. Open your profile → Performance Calibration → **Race PRs + VDOT**.
2. Confirm Time and Date are readable across the card rather than squeezed into
   a vertical date column. Open the date picker, select a past date, and cancel
   if you do not have an actual result to enter here.
3. Open More → Activity and choose an existing, completed running activity for a
   race you actually finished. Open its detail → **Edit**.
4. Find **Race or time-trial result**. Set Performance type to **Completed race**
   (or Completed time trial for an actual time trial), choose the exact Event
   distance, and enter **Elapsed finish time** as MM:SS or H:MM:SS.
5. Use the actual event date and full official/elapsed finish time, including
   stops. Do not substitute GPS distance or active recording time. Leave the
   recorded sensor fields alone unless they genuinely need correcting.
6. Save once. Return to the profile's Race PRs + VDOT section. Confirm the
   result appears under the right event and is identified as a personal best
   if it is your first or fastest valid result at that distance.
7. Check VDOT, training paces and the race-prediction section. A valid recent
   result should feed calibration; an older/slower entry may not change the
   displayed values if stronger/current evidence already determines them.
8. Check the corresponding achievement. Newly entered qualifying first/better
   results can celebrate; old history discovered during migration may quietly
   unlock without a surprise popup. Correcting the same source is quiet.
9. Close/reopen StrideOS and revisit the activity/profile/achievement. There
   should be one activity and no repeated celebration for the same result.

Do not enter invented faster times into your real training history to force a
popup. Repeat-PR, ties, corrections and deletion/re-add scenarios can be tested
later in a separate disposable test context. You do not need to run all six
distances now. A race time updates performance evidence, not a measured HRmax;
heart-rate measurements and HR-zone settings retain their separate meaning.

**Pass:** layout readable, genuine result linked to the correct event, no duplicate
activity/celebration, six badge faces correct.

## 6. Review Health permissions and the cleaner Watch screen

1. With no activity recording, open StrideOS on the Watch and keep it foreground.
2. On iPhone, open More → Settings → Apple Health. If already connected, tap the
   **Connected** control → **Review permissions**; otherwise use Connect.
3. Respond to the normal iPhone/Watch permission sheets using your preferred
   choices. The Watch may finish another permission prompt first.
4. Confirm there is no separate **Enable Workout Metrics** button on the Watch.
5. Confirm normal release screens no longer show the raw **Sync details** or
   **Show Watch sync details** diagnostic panels. Useful connection/error/retry
   messages may still appear.
6. Do not start while a permission sheet is open. If you do, finish setup and
   follow the displayed retry instruction; it should not create a second run.

Permissions control available measurements. An accepted permission request does
not guarantee every sensor value will be present.

**Pass:** one coherent Health setup flow, no extra metrics button/raw debug panels.

## 7. One combined Running regression — aim for at least 8 active minutes

This repeats a short recording because the new build changes auto-pause,
recovery and native Health setup. Your successful build-111 tests remain recorded.

1. Go outdoors somewhere safe, bring your phone, and open the Watch app. Use the
   **Running** tab to start an outdoor **run**; walking pace is fine. This is
   different from logging a Walking/Hiking activity.
2. Before starting, set **Auto-pause runs** to **Off**. The **Announce auto-pause**
   option is only a spoken cue; it is not the detector switch.
3. Start, remain still for 30–60 seconds, and confirm the run does not auto-pause.
4. Move for a minute. Lock the phone for a minute and check that the Watch still
   shows the same session and available measurements.
5. Use Watch Pause, then Resume. The phone should agree. While paused, move a
   short distance, then resume; paused movement should not suddenly add a large
   distance/elevation jump on resuming.
6. Enable auto-pause, then stop moving for up to a minute. Check for automatic
   pause. Resume moving to check automatic resume when that mode is selected.
7. Turn auto-pause Off again. If the session is already paused, tap **Resume
   Run** yourself; switching Off does not secretly resume a paused run.
8. Continue until the counter shows **at least 8 active minutes**; pauses do not
   count toward that total.
9. While it is still recording, completely close StrideOS and reopen it. Expect
   **Activity still open** with **Resume activity** and **Stop activity**.
10. Choose **Resume activity**. Confirm it returns to the existing session and
    keeps the timer/history rather than starting another run. Check Off remained
    Off, then move briefly and pause/resume once more.
11. Turn Airplane Mode on and Wi-Fi off on the phone. Stop once using **STOP RUN**
    and wait for **Run saved**. If there is an error, keep the app open and record
    it rather than repeatedly pressing Stop.
12. Open More → Activity and the saved run. Completely close/reopen while still
    offline and confirm the completed run remains. A completed saved run should
    not show the “Activity still open” prompt.
13. Restore the connection, wait one minute, and confirm one saved activity.
    Check map, distance and pace for obvious implausible jumps.
14. In Apple Health, find the workout at the same start time and inspect its
    source. Expect one matching StrideOS-written workout if workout-writing
    permission was enabled. Other genuinely separate workouts are not duplicates.

If desired, on a second session use the recovery prompt's **Stop activity** path
after at least five active minutes, so the normal short-run discard rule does
not obscure the save test. Runs stopped below the save threshold show a warning;
do not mistake a confirmed discard for failed persistence.

**Pass:** Off stays Off, supported auto-pause works, Watch/phone agree, recovery
offers the right choice, one durable offline save and one matching Health workout.

## 8. Check the separate Walking/Hiking expectation

1. Open More → Activity → **Track Workout**, choose Walking (and Hiking if you
   want to check both), and start a short recording. An empty-history screen
   labels the same entry **Start an Activity**.
2. Stand still briefly. These activity types do not use the Running auto-pause
   detector in this release. Use their manual Pause/Resume controls.
3. Stop/save, open the result and confirm the correct activity type and a single
   saved entry. Do not expect Running's auto-pause switch to control Walking/Hiking.

**Pass:** the supported behavior is clear and manual controls/save work.

## 9. Check email carry-over and Apple Passwords last

Do this only after saving every activity and confirming you privately know your
usual account's sign-in/recovery method. Keep your usual account on this phone.

1. Sign out through the app's normal control. Do not reset or clear training data.
2. In Sign in, type your usual email, then tap **Forgot password?**.
3. Confirm the email is already filled in and is editable. You can return without
   sending a reset email if you are only checking carry-over.
4. Return to Sign in and sign back into that same usual account. Check your
   history. If Apple Passwords offers Save/Update, accept only if you want to.
5. If testing an actual password change, request one reset, open the latest email
   on the phone, finish the reset, and use Continue if shown. Check Apple Passwords
   saved/updated the right account, then relaunch and confirm access/history.

iOS controls its save/update prompt. Report whether it appeared, was already
saved, or was unavailable; a missing prompt alone is not proof of failed login.
Never send a password, reset URL, recovery code or screenshot showing credentials.

**Pass:** email carries over; same-owner login/recovery preserves data; report the
actual system Passwords behavior.

## 10. Send one result summary, then do the separate launch gates

Copy this and fill it in. Stop at the first serious data/saving problem and send
that error immediately; the rest can wait.

```text
Build installed: 113
Watch app updated: yes / no
Old history intact:
Rome archive opens, including after restart:
Tours highlight, scroll and dismiss:
Name/username visibility survives restart:
PR/date form readable:
Real result / calibration / correct badge:
13.1 and 26.2 artwork correct:
No duplicate PR popup after restart:
Health setup on Watch / extra metrics button removed:
Raw sync diagnostics hidden:
Auto-pause Off stays Off / On works:
Resume prompt returns to same run:
Eight-minute offline run saved / retained / exactly one after reconnect:
Matching Health workout count and source:
Walking/Hiking manual controls:
Forgot-password email carried over:
Apple Passwords behavior:
Problems: screen, exact error, approximate time
```

After these results, the remaining order is:

1. **Fresh-account/signup/reviewer acceptance:** use a separately prepared clean
   test context, not a new login over your personal local history. Coordinate
   the temporary signup policy and exact test inbox/native return first.
2. **Disposable-account deletion:** identify the exact disposable account and
   approve that deletion specifically. Then test provider revocation, completion
   receipt, local cleanup/restart and owner isolation. Never delete your usual
   account or the reviewer account you intend to keep.
3. **Subscriptions, if launch is paid:** use an explicitly identified private
   purchase candidate and test-owner binding. Complete Apple's sandbox purchase,
   cancellation, restore, renewal, expiry/refund/revocation and entitlement checks.
   Build 113 keeps purchases disabled; do not try to buy in it or install an old
   private build without coordination. These steps include time-based events.
4. **Final store packet:** verify actual required screenshot wells, current native
   captures without personal data, accepted reviewer/deletion/payment instructions,
   exact accepted public binary, privacy answers and manual release. The prepared
   package is not public-review-ready until these acceptance gates are closed.
5. **Owner final decision:** approve public App Review submission; after approval,
   approve the manual public launch. Neither happens merely by installing 113.

The assistant owns the technical preparation, receipt checks, store drafting and
reconciliation; the owner supplies only private prompts, physical-device results,
identity/deletion authorization and final release decisions that require them.
