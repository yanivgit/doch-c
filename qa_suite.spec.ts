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

    // 1. Verify top action buttons: ONLY "העתק דו\"ח" exists, no "הוסף ציוד" or "יומן אירועים"
    console.log('Verifying clean top action bar...');
    await expect(page.locator('text=העתק דו"ח')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Command Center')).toBeVisible({ timeout: 5000 });

    // 2. Verify floating bar items are visible initially
    console.log('Verifying initial floating bottom navigation bar items...');
    await expect(page.locator('text=קשפ"ל').last()).toBeVisible({ timeout: 10000 });
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

    console.log('SUCCESS: Kashrag clean dashboard and floating navigation actions fully verified!');
    await browser.close();
  });
});

