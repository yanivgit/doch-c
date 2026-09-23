# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa_suite.spec.ts >> Continuous QA Suite: Doh Ts App >> Phase 2: Network Resilience (Offline State Sync)
- Location: qa_suite.spec.ts:87:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8081/
Call log:
  - navigating to "http://localhost:8081/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
  2   | 
  3   | // Use local dev server URL
  4   | const URL = 'http://localhost:8081';
  5   | const PASSCODE = '1379';
  6   | 
  7   | test.describe('Continuous QA Suite: Doh Ts App', () => {
  8   | 
  9   |   test('Phase 1: Concurrent Real-Time Sync (Kashrag & Kashpal)', async () => {
  10  |     // We launch two separate isolated contexts
  11  |     const browser = await chromium.launch();
  12  |     
  13  |     // Context A: Kashrag (Admin)
  14  |     const contextA = await browser.newContext();
  15  |     const pageA = await contextA.newPage();
  16  |     
  17  |     // Context B: Kashpal (Field)
  18  |     const contextB = await browser.newContext();
  19  |     const pageB = await contextB.newPage();
  20  | 
  21  |     console.log('Logging in Kashrag (Context A)...');
  22  |     await pageA.goto(URL);
  23  |     await pageA.click('text=קשר"ג');
  24  |     
  25  |     // Passcode modal
  26  |     const passcodeA = pageA.locator('input[placeholder="הכנס סיסמה"]');
  27  |     if (await passcodeA.isVisible()) {
  28  |       await passcodeA.fill(PASSCODE);
  29  |       await pageA.keyboard.press('Enter');
  30  |     }
  31  |     await pageA.waitForURL('**/report/kashrag');
  32  | 
  33  |     console.log('Logging in Kashpal (Context B)...');
  34  |     await pageB.goto(URL);
  35  |     await pageB.click('text=פלוגה א\'');
  36  |     
  37  |     const passcodeB = pageB.locator('input[placeholder="הכנס סיסמה"]');
  38  |     if (await passcodeB.isVisible()) {
  39  |       await passcodeB.fill(PASSCODE);
  40  |       await pageB.keyboard.press('Enter');
  41  |     }
  42  |     await pageB.waitForURL('**/user/platoon');
  43  | 
  44  |     // 1. Kashrag starts global session
  45  |     console.log('Kashrag starting global session...');
  46  |     const startBtn = pageA.locator('text=הפעל דו"ח לכל הפלוגות');
  47  |     if (await startBtn.isVisible()) {
  48  |       await startBtn.click();
  49  |     } else {
  50  |       // Maybe a session is already active, let's reset it to be clean
  51  |       const resetBtn = pageA.locator('text=איפוס');
  52  |       if (await resetBtn.isVisible()) await resetBtn.click();
  53  |     }
  54  |     
  55  |     // 2. Kashpal waits for active banner
  56  |     console.log('Kashpal waiting for real-time banner update...');
  57  |     await expect(pageB.locator('text=דו"ח פעיל')).toBeVisible({ timeout: 10000 });
  58  | 
  59  |     // 3. Kashpal updates a device location
  60  |     console.log('Kashpal updating a device location...');
  61  |     // Find the first device map-pin icon
  62  |     const mapPin = pageB.locator('css=[class*="map-pin"]').first();
  63  |     await mapPin.click();
  64  |     
  65  |     // Fill the location modal
  66  |     const locInput = pageB.locator('input[placeholder="לדוגמה: עמדת שמירה צפונית"]');
  67  |     const testLocation = 'E2E_Test_Loc_' + Date.now();
  68  |     await locInput.fill(testLocation);
  69  |     await pageB.click('text=שמור');
  70  | 
  71  |     // 4. Kashrag verifies the update in absolute real-time without refreshing
  72  |     console.log('Kashrag verifying sync without refresh...');
  73  |     // Expand Platoon A accordion if needed
  74  |     const accordion = pageA.locator('text=פלוגה א\'').first();
  75  |     await accordion.click();
  76  |     
  77  |     // The device should now display the test location
  78  |     const syncedLocation = pageA.locator(`text=${testLocation}`);
  79  |     await expect(syncedLocation).toBeVisible({ timeout: 5000 });
  80  |     console.log('SUCCESS: Real-time sync verified!');
  81  | 
  82  |     // Cleanup
  83  |     await pageA.click('text=סיים דו"ח');
  84  |     await browser.close();
  85  |   });
  86  | 
  87  |   test('Phase 2: Network Resilience (Offline State Sync)', async () => {
  88  |     const browser = await chromium.launch();
  89  |     const context = await browser.newContext();
  90  |     const page = await context.newPage();
  91  | 
> 92  |     await page.goto(URL);
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8081/
  93  |     await page.click('text=פלוגה ב\''); // Use a different platoon to avoid conflicts
  94  |     
  95  |     const passcode = page.locator('input[placeholder="הכנס סיסמה"]');
  96  |     if (await passcode.isVisible()) {
  97  |       await passcode.fill(PASSCODE);
  98  |       await page.keyboard.press('Enter');
  99  |     }
  100 |     
  101 |     // Simulate Offline
  102 |     console.log('Simulating Network Drop (Offline mode)...');
  103 |     await context.setOffline(true);
  104 | 
  105 |     // Try to update location while offline
  106 |     const mapPin = page.locator('css=[class*="map-pin"]').first();
  107 |     await mapPin.click();
  108 |     const testLocation = 'Offline_Test_' + Date.now();
  109 |     await page.locator('input[placeholder="לדוגמה: עמדת שמירה צפונית"]').fill(testLocation);
  110 |     await page.click('text=שמור');
  111 | 
  112 |     // Restore Network
  113 |     console.log('Restoring Network Connection...');
  114 |     await context.setOffline(false);
  115 |     
  116 |     // Wait a moment for Firebase to sync queued writes
  117 |     await page.waitForTimeout(3000);
  118 |     
  119 |     // We can open a Kashrag context here to verify the write successfully made it to the cloud
  120 |     const adminContext = await browser.newContext();
  121 |     const adminPage = await adminContext.newPage();
  122 |     await adminPage.goto(URL);
  123 |     await adminPage.click('text=קשר"ג');
  124 |     if (await adminPage.locator('input[placeholder="הכנס סיסמה"]').isVisible()) {
  125 |       await adminPage.locator('input[placeholder="הכנס סיסמה"]').fill(PASSCODE);
  126 |       await adminPage.keyboard.press('Enter');
  127 |     }
  128 |     await adminPage.waitForURL('**/report/kashrag');
  129 |     
  130 |     const accordion = adminPage.locator('text=פלוגה ב\'').first();
  131 |     await accordion.click();
  132 |     const syncedLocation = adminPage.locator(`text=${testLocation}`);
  133 |     await expect(syncedLocation).toBeVisible({ timeout: 5000 });
  134 |     
  135 |     console.log('SUCCESS: Offline queue synced successfully upon reconnection!');
  136 |     await browser.close();
  137 |   });
  138 | 
  139 | });
  140 | 
```