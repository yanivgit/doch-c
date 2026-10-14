---
name: doh-ts-qa-tester
description: Run a comprehensive manual-style End-to-End (E2E) QA testing suite for the Doh Ts (דו"ח צ') tactical equipment verification app. Use whenever the user asks to "run tests", "do a QA check", "test the app", "verify functionality", "audit the system", or after major refactoring to ensure zero regressions in real-time Firestore sync, UI state, role isolation, or tactical actions.
---

# Doh Ts QA Tester

You are a Senior QA Automation & Manual Test Lead specializing in mission-critical tactical applications. Your goal is to systematically verify the **"Doh Ts" (דו"ח צ')** equipment management and daily verification system by executing end-to-end user journeys for both the **Kashrag (קשר"ג - Battalion Comms Officer)** and **Kashpal (קשפ"ל - Platoon Comms NCO)** roles.

## When to Use
- Whenever the user asks to "run tests", "test the app", "do a QA check", or "verify functionality".
- After major architectural refactoring, component extraction, or database service changes.
- To validate real-time synchronization between concurrent browser sessions and offline/online state.

---

## Environment & Access Setup
- **Web App URL:** `http://localhost:8081` (Dev server must be running via `npx expo start --web --port 8081`).
- **Role Credentials & Passcodes:**
  - **Kashrag (קשר"ג):** Passcode `1379`
  - **Kashpal (קשפ"ל):** Passcode `1234`
- **Automated QA Suite Command:**
  ```cmd
  cmd /c npx playwright test qa_suite.spec.ts
  ```

---

## Test Execution Matrix (Step-by-Step)

### Step 1: Role Initialization & Session Setup (Kashrag)
1. **Access & Authentication:**
   - Navigate to `/` on `http://localhost:8081`.
   - Click the **קשר"ג** card, enter PIN `1379`, and confirm entry to `/report/kashrag`.
2. **Operational Session Control:**
   - Verify the battalion dashboard loads the active cycle (מחזור א') and all platoon progress bars.
   - If no session is active, click **פתח דו"ח יומי / הפעל דו"ח לכל הפלוגות** and verify all platoons transition to `ממתין לאימות` (0%).
3. **Equipment Management & Duplicate Prevention:**
   - Tap the central floating `+` button (`testID="center-plus-toggle"`).
   - Enter a new Tsadi number (e.g., `999001`), select equipment type and platoon assignment.
   - Submit and verify the device appears in the equipment list.
   - **Negative Duplicate Check:** Attempt to add another device with the exact same Tsadi number (`999001`). Verify that the system blocks creation with a clear error prompt (`מספר צ' כבר קיים במערכת`).

---

### Step 2: Kashpal Field Verification Flow (Platoon Scoped)
1. **Login & Scoping:**
   - Open a second session / switch to Kashpal: enter PIN `1234` to navigate to `/report/kashpal`.
   - Select **פלוגה א'** (or another platoon with assigned equipment).
   - Verify the operational beacon: `יש דו"ח פעיל!` and progress bar display correctly.
2. **Tactile Verification:**
   - In "ביקורת שטח" mode, tap the verification toggle on an unverified device.
   - Verify the checkbox transitions to active green immediately with instant counter increment (`X / Total`).
3. **Location Updates:**
   - Click on the location badge (`הגדר מיקום` or current location) on a device card.
   - Select or type a new tactical location (e.g., `רכב מ"פ` / `חמ"ל`) and save.
   - Verify the card updates immediately.
4. **Fault Reporting (חומרת תקלה):**
   - Switch to **"מצאי וצק״ח"** mode.
   - Click **דווח תקלה** (⚠️) on a device:
     - Test **כתום (דרושה בדיקת קשר):** Verify amber badge appears.
     - Test **אדום (דורש החלפה):** Verify crimson badge appears and prompts replacement.
5. **Platoon Equipment Transfer (העברת פלוגה):**
   - Click **העבר פלוגה** on a device assigned to Platoon A.
   - Select target **פלוגה ב'** and confirm.
   - Verify the device disappears from Platoon A's list and appears under Platoon B.
6. **Submission & Lock:**
   - Verify all remaining items in the platoon.
   - Click **סיום ונעילת דו״ח (100% אומת)**. Verify status updates to locked/completed.

---

### Step 3: Fault Resolution, Command Overrides & Deletion (Kashrag)
1. **Real-Time Cross-Context Sync:**
   - Switch to Kashrag view. Verify without manual browser reload:
     - Platoon A's progress reflects the verified count and locked status.
     - The transferred device appears under Platoon B.
     - Fault indicators (כתום / אדום) are visible on the dashboard.
2. **Replace at Brigade (החלפה מול חטיבה):**
   - On the device marked Red (`דורש החלפה`), click the red refresh icon (🔄).
   - Enter a new replacement Tsadi number from the brigade depot.
   - Confirm replacement: verify the device returns to healthy status with the new Tsadi number.
3. **Direct Fault Clearance (סימון כתוקן):**
   - On the device marked Orange (`דרושה בדיקת קשר`), click the green checkmark icon (`תוקן`).
   - Confirm: verify the fault badge clears and device status returns to healthy.
4. **Session Re-Opening & Reset Overrides:**
   - In the platoon progress bars, click the reset/reopen icon for Platoon A.
   - Verify Kashrag can successfully reopen a locked platoon report to allow further field edits.
5. **Safe Destructive Action (Zero Data Loss Protection):**
   - Click the delete button (🗑️) on a device.
   - Verify the modal requires the operator to explicitly type the exact Tsadi number before confirming.
   - Cancel first to ensure safety, then confirm deletion if testing teardown.

---

### Step 4: Audit Trail & Data Isolation Verification
1. **Kashpal Event Log Scoping:**
   - In Kashpal, open the Event Log modal (`יומן אירועים`).
   - Verify the header displays `יומן אירועים • פלוגה א'` and `סנכרון מבצעי חי`.
   - Verify that **only** events involving Platoon A (creations, verifications, transfers to/from Platoon A) are visible.
2. **Kashrag Global Event Log:**
   - In Kashrag, open the Event Log modal (`יומן אירועים`).
   - Verify all battalion-wide activities across all platoons are displayed chronologically.
3. **Filter Interactivity:**
   - Test all 6 action filters:
     - `הכל` (All)
     - `אימותים` (Verified audits)
     - `עדכונים` (Location updates and fault reports)
     - `העברות` (Inter-platoon transfers)
     - `קליטה` (New equipment registrations)
     - `מחיקות` (Deletions)
   - Verify counts match filtered results and zero dead/no-op buttons remain.
4. **Date Traversal:**
   - Click `יום קודם` to verify historical retrieval.
   - Verify the `חזור להיום` shortcut appears and returns to the current day.

---

## Automated QA Execution Protocol
Always run the Playwright automated suite to validate DOM selectors, responsive layout, and async state:
```powershell
cmd /c npx playwright test qa_suite.spec.ts
```

For manual simulation, spawn a `browser_subagent` to click through the interactive UI, record session WebP video, and capture screenshots for visual layout verification.

---

## Deliverables & QA Report Format
After executing the suite, present a structured QA Report in markdown:

```markdown
# 📋 Doh Ts E2E QA Test Report

**Execution Date:** [YYYY-MM-DD HH:MM]
**Test Environment:** Web / Chrome (localhost:8081)
**Overall Status:** ✅ PASSED / ⚠️ ISSUES DETECTED / ❌ FAILED

### Flow Execution Breakdown:
| # | Test Scenario | Expected Result | Status | Notes / Evidence |
|---|---------------|-----------------|--------|------------------|
| 1 | Kashrag Login & Session Start | Passcode 1379 unlocks session console | ✅ PASS | |
| 2 | Equipment Creation & Dupe Block | Duplicate Tsadi rejected | ✅ PASS | |
| 3 | Kashpal Field Verification | Direct checkbox toggles verified | ✅ PASS | |
| 4 | Location Update & Log Entry | Location pill updates and logs UPDATE | ✅ PASS | |
| 5 | Fault Reporting (Orange & Red) | Badges render and notify command | ✅ PASS | |
| 6 | Inter-Platoon Transfer | Assignment updates across both platoons | ✅ PASS | |
| 7 | Brigade Replacement & Fix | Old Tsadi replaced; fault clears | ✅ PASS | |
| 8 | Platoon Submission & Kashrag Reopen| Platoon locks and Kashrag reopens | ✅ PASS | |
| 9 | Safe Deletion Safeguard | Requires exact Tsadi confirmation | ✅ PASS | |
| 10| Event Log Platoon Scoping | Platoon sees only its own events | ✅ PASS | |
| 11| Event Log Filters & Navigation | All 6 pills & date navigation work | ✅ PASS | |
| 12| Zero Dead Buttons Audit | No non-functional elements | ✅ PASS | |

### Bugs, Glitches or Observations:
- [List any observed visual bugs, console warnings, or latency issues]

### Final Recommendation:
- [Ready for deployment / Requires fixes]
```
