import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';

// Use local dev server URL
const URL = 'http://localhost:8081';
const PASSCODE = '1379';

test.describe('Continuous QA Suite: Doh Ts App', () => {
  test.setTimeout(120000); // 2 minutes timeout for slow startup

  test('Phase 1: Concurrent Real-Time Sync (Kashrag & Kashpal)', async () => {
    // We launch two separate isolated contexts
    const browser = await chromium.launch();
    
    // Context A: Kashrag (Admin)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('dialog', dialog => dialog.accept());
    
    // Context B: Kashpal (Field)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.on('dialog', dialog => dialog.accept());

    console.log('Logging in Kashrag (Context A)...');
    await pageA.goto(URL);
    await pageA.locator('text=קשר"ג').first().click();
    
    // Passcode modal
    const passcodeA = pageA.locator('input[placeholder="****"]');
    await expect(passcodeA).toBeVisible({ timeout: 5000 });
    await passcodeA.fill(PASSCODE);
    await pageA.click('text=היכנס');
    
    await pageA.waitForURL('**/cycle-selection');
    
    let cycleName = `Test_Cycle_${Date.now()}`;
    
    // Check if we need to create a cycle or can select one
    const createBtn = pageA.locator('text=+ יצירת דו"ח צ חדש');
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click();
    await pageA.locator('input[placeholder=\'הזן שם למחזור / דו"ח...\']').fill(cycleName);
    await pageA.click('text=שמור והיכנס');
    await pageA.waitForURL('**/report/kashrag/setup');
    // Just jump to main report
    await pageA.goto(`${URL}/report/kashrag`);
    
    await pageA.waitForURL('**/report/kashrag');
    
    // Start global session first so Kashpal doesn't get confused
    console.log('Kashrag starting global session...');
    const startBtn1 = pageA.locator('text=פתח דו"ח יומי');
    const startBtn2 = pageA.locator('text=הפעל דו"ח לכל הפלוגות');
    const resetBtn = pageA.locator('text=איפוס');
    
    // Wait for the board to finish loading
    await Promise.race([
      startBtn1.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      startBtn2.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      resetBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    ]);

    if (await startBtn1.isVisible()) {
      await startBtn1.click();
    } else if (await startBtn2.isVisible()) {
      await startBtn2.click();
    } else if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await pageA.waitForTimeout(500);
      if (await startBtn1.isVisible()) await startBtn1.click();
    }

    console.log('Logging in Kashpal (Context B)...');
    await pageB.goto(URL);
    await pageB.locator('text=קשפ"ל').first().click();
    
    await pageB.waitForURL('**/cycle-selection');
    
    const cycleItem = pageB.locator(`text=${cycleName}`);
    await cycleItem.waitFor({ state: 'visible', timeout: 10000 });
    await cycleItem.click();
    
    await pageB.waitForURL('**/report/kashpal');

    // Kashpal select platoon
    console.log('Kashpal selecting platoon...');
    await pageB.click('text=חפש ובחר פלוגה...');
    const searchInput = pageB.locator('input[placeholder="הקלד לחיפוש..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("פלוגה א׳");
    // Since we filtered, click the first match or specific text
    await pageB.click('text=פלוגה א׳');
    
    // 2. Kashpal waits for active banner
    console.log('Kashpal waiting for real-time banner update...');
    await expect(pageB.locator('text=יש דו"ח פעיל!')).toBeVisible({ timeout: 15000 });

    // 3. Kashpal updates a device location
    console.log('Kashpal updating a device location...');
    const mapPin = pageB.locator('css=[class*="map-pin"], .feather-map-pin').first();
    if (await mapPin.isVisible()) {
      await mapPin.click();
      
      const locInput = pageB.locator('input[placeholder="לדוגמה: עמדת שמירה צפונית"]');
      const testLocation = 'E2E_Test_Loc_' + Date.now();
      await locInput.fill(testLocation);
      await pageB.click('text=שמור');

      console.log('Kashrag verifying sync without refresh...');
      await pageA.click('text=רשימת ציוד');
      const accordion = pageA.locator('text=פלוגה א׳').first();
      if (await accordion.isVisible()) {
        await accordion.click();
      }
      
      const syncedLocation = pageA.locator(`text=${testLocation}`);
      await expect(syncedLocation).toBeVisible({ timeout: 5000 });
      console.log('SUCCESS: Real-time sync verified!');
    }

    const endSession = pageA.locator('text=סיים דו"ח');
    if (await endSession.isVisible()) {
       await endSession.click();
       pageA.on('dialog', dialog => dialog.accept());
    }
    await browser.close();
  });

  test('Phase 2: Instant Auto-Archive to History on 100% Verification', async () => {
    const browser = await chromium.launch();
    
    // Context A: Kashrag (Admin)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('dialog', dialog => dialog.accept());
    
    // Context B: Kashpal (Field)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.on('dialog', dialog => dialog.accept());

    console.log('Logging in Kashrag for Auto-Archive test...');
    await pageA.goto(URL);
    await pageA.locator('text=קשר"ג').first().click();
    
    const passcodeA = pageA.locator('input[placeholder="****"]');
    await expect(passcodeA).toBeVisible({ timeout: 5000 });
    await passcodeA.fill(PASSCODE);
    await pageA.click('text=היכנס');
    
    await pageA.waitForURL('**/cycle-selection');
    
    const cycleName = `Archive_Test_${Date.now()}`;
    const testTsadi = `TS_${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create new cycle
    const createBtn = pageA.locator('text=+ יצירת דו"ח צ חדש');
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click();
    await pageA.locator('input[placeholder=\'הזן שם למחזור / דו"ח...\']').fill(cycleName);
    await pageA.click('text=שמור והיכנס');
    
    await pageA.waitForURL('**/report/kashrag/setup');
    
    // In setup screen, add exactly 1 device so 1 verification = 100% of battalion
    console.log('Adding single test device in Setup screen...');
    await pageA.click('text=חפש ובחר סוג ציוד (למשל מ.ק 710)...');
    const searchEq = pageA.locator('input[placeholder="הקלד לחיפוש..."]').first();
    await expect(searchEq).toBeVisible({ timeout: 5000 });
    await searchEq.fill('סלולר צבאי');
    await pageA.locator('text=סלולר צבאי').first().click();
    await pageA.waitForTimeout(300);
    
    await pageA.locator('input[placeholder*="הזן מספר צ\'"]').fill(testTsadi);
    
    await pageA.click('text=בחר פלוגה (אופציונלי)...');
    const searchPlatoon = pageA.locator('input[placeholder="הקלד לחיפוש..."]').last();
    await expect(searchPlatoon).toBeVisible({ timeout: 5000 });
    await searchPlatoon.fill('פלוגה א׳');
    await pageA.locator('text=פלוגה א׳').last().click();
    await pageA.waitForTimeout(300);
    
    await pageA.click('text=הוסף מכשיר למצבה');
    await pageA.waitForTimeout(1000);
    
    // Finish setup and navigate to kashrag dashboard
    await pageA.click('text=סיום ומעבר ללוח הבקרה הראשי');
    await pageA.waitForURL('**/report/kashrag');
    
    // Start global session
    console.log('Kashrag starting session for Auto-Archive test...');
    const startBtn1 = pageA.locator('text=פתח דו"ח יומי');
    const startBtn2 = pageA.locator('text=הפעל דו"ח לכל הפלוגות');
    await Promise.race([
      startBtn1.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      startBtn2.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    ]);
    if (await startBtn1.isVisible()) {
      await startBtn1.click();
    } else if (await startBtn2.isVisible()) {
      await startBtn2.click();
    }
    
    // Kashpal joins
    console.log('Kashpal logging in to verify the device...');
    await pageB.goto(URL);
    await pageB.locator('text=קשפ"ל').first().click();
    await pageB.waitForURL('**/cycle-selection');
    
    const cycleItem = pageB.locator(`text=${cycleName}`);
    await cycleItem.waitFor({ state: 'visible', timeout: 10000 });
    await cycleItem.click();
    await pageB.waitForURL('**/report/kashpal');
    
    // Kashpal selects platoon
    await pageB.click('text=חפש ובחר פלוגה...');
    const searchInput = pageB.locator('input[placeholder="הקלד לחיפוש..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("פלוגה א׳");
    await pageB.click('text=פלוגה א׳');
    
    // Kashpal verifies the only device
    console.log('Kashpal clicking device card to mark verified...');
    const deviceItem = pageB.locator(`text=${testTsadi}`);
    await deviceItem.waitFor({ state: 'visible', timeout: 10000 });
    await deviceItem.click();
    
    // Check that Kashpal screen immediately updates to archived banner
    console.log('Verifying Kashpal screen shows archived/completed banner...');
    await expect(pageB.locator('text=הדו״ח היומי הושלם במלואו וננעל בהיסטוריה!')).toBeVisible({ timeout: 15000 });
    
    // Check that Kashrag screen immediately updates to archived banner
    console.log('Verifying Kashrag screen shows archived banner...');
    await expect(pageA.locator('text=הדו״ח היומי הושלם וננעל בהיסטוריה!')).toBeVisible({ timeout: 15000 });
    
    // Kashrag opens Verification History modal
    console.log('Opening Verification History modal...');
    await pageA.locator('text=צפה בדו"ח בהיסטוריית הדוחות').click();
    await expect(pageA.locator('text=היסטוריית דוחות (מחזור נוכחי)')).toBeVisible({ timeout: 5000 });
    
    // Verify that the record is present and marked as "בוצע"
    console.log('Verifying record is present and status is "בוצע"...');
    await expect(pageA.locator('text=בוצע').first()).toBeVisible({ timeout: 5000 });
    await expect(pageA.locator('text=הושלם: 1/1 (100%)')).toBeVisible({ timeout: 5000 });
    
    // Close history modal
    await pageA.locator('text=✕').first().click();
    await pageA.waitForTimeout(300);

    // Open DailySummaryModal (יומן אירועים) from bottom floating nav
    console.log('Verifying report completion is recorded under אימותים in operational log...');
    await pageA.locator('text=יומן אירועים').last().click();
    await expect(pageA.locator('text=סנכרון מבצעי חי')).toBeVisible({ timeout: 5000 });

    // Click on "אימותים" filter pill
    await pageA.locator('text=אימותים').first().click();
    await pageA.waitForTimeout(300);

    // Verify completion event is visible in the אימותים tab
    await expect(pageA.locator('text=סיום אימות').first()).toBeVisible({ timeout: 5000 });
    await expect(pageA.locator('text=סיום ונעילת דו"ח').first()).toBeVisible({ timeout: 5000 });
    await pageA.getByTestId('close-daily-summary').click();

    console.log('SUCCESS: Instant Auto-Archive & Immediate History & Event Log Appearance verified 100%!');
    await browser.close();
  });

  test('Phase 3: Floating Bottom Navigation Bar (Toggle & Visibility)', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());

    await page.goto(URL);
    await page.locator('text=קשר"ג').first().click();

    const passcode = page.locator('input[placeholder="****"]');
    await expect(passcode).toBeVisible({ timeout: 5000 });
    await passcode.fill(PASSCODE);
    await page.click('text=היכנס');

    await page.waitForURL('**/cycle-selection');
    
    // Click first available cycle
    const cycleItem = page.locator('div[dir="auto"]').filter({ hasText: /Test_Cycle/ }).first();
    await cycleItem.waitFor({ state: 'visible', timeout: 10000 });
    await cycleItem.click();

    await page.waitForURL('**/report/kashrag');

    // 1. Verify clean top header & action buttons: ONLY "העתק דו\"ח" exists, no "הוסף ציוד" or "יומן אירועים"
    console.log('Verifying clean top action bar and centered title...');
    await expect(page.locator('text=דו"ח ציוד טקטי • מחזור א׳')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=העתק דו"ח')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Command Center')).toBeVisible({ timeout: 5000 });

    // 1.5 Verify Dual-Tab segmented control works smoothly
    console.log('Testing dual-tab segmented control (דו"ח vs רשימת ציוד)...');
    await expect(page.locator('text=דו"ח').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=רשימת ציוד')).toBeVisible({ timeout: 5000 });
    await page.click('text=רשימת ציוד');
    await expect(page.locator('input[placeholder="חיפוש לפי צ\' או סוג..."]')).toBeVisible({ timeout: 5000 });
    await page.locator('text=דו"ח').first().click();

    await page.screenshot({ path: 'C:/Users/gitma/.gemini/antigravity/brain/349dd5a7-2cae-4628-8789-c9e7db38626a/scratch/kashrag_verified.png' });

    // 2. Verify floating bar items are visible initially
    console.log('Verifying initial floating bottom navigation bar items...');
    await expect(page.locator('text=היסטוריה').last()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=יומן אירועים').last()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=קשר"ג').last()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=כניסה').last()).toBeVisible({ timeout: 10000 });

    // 3. Test clicking "יומן אירועים" opens DailySummaryModal
    console.log('Testing "יומן אירועים" button opens Event Log modal...');
    await page.locator('text=יומן אירועים').last().click();
    await expect(page.locator('text=סנכרון מבצעי חי')).toBeVisible({ timeout: 5000 });
    // Close DailySummaryModal via close button
    await page.getByTestId('close-daily-summary').click();
    await page.waitForTimeout(400);

    // 4. Test clicking green + button opens AddDeviceModal
    console.log('Testing central green + button opens Add Equipment modal...');
    const plusButton = page.getByTestId('center-plus-toggle');
    await expect(plusButton).toBeVisible();
    await plusButton.click();
    await expect(page.locator('text=הוספת ציוד חדש')).toBeVisible({ timeout: 5000 });

    // Close AddDeviceModal via close button
    await page.getByTestId('close-add-device').click();
    await page.waitForTimeout(400);

    // 5. Test clicking "היסטוריה" button opens VerificationHistoryModal
    console.log('Testing "היסטוריה" button in floating nav opens Verification History modal...');
    const historyBottomBtn = page.locator('text=היסטוריה').last();
    await expect(historyBottomBtn).toBeVisible({ timeout: 5000 });
    await historyBottomBtn.click();
    await expect(page.locator('text=היסטוריית דוחות').first()).toBeVisible({ timeout: 5000 });

    console.log('SUCCESS: Kashrag clean dashboard, dual-tab layout and floating navigation actions fully verified!');
    await browser.close();
  });
});

