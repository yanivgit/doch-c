import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';

// Use local dev server URL
const URL = 'http://localhost:8081';
const PASSCODE = '1379';

test.describe('Continuous QA Suite: Doh Ts App', () => {

  test('Phase 1: Concurrent Real-Time Sync (Kashrag & Kashpal)', async () => {
    // We launch two separate isolated contexts
    const browser = await chromium.launch();
    
    // Context A: Kashrag (Admin)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    
    // Context B: Kashpal (Field)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    console.log('Logging in Kashrag (Context A)...');
    await pageA.goto(URL);
    await pageA.click('text=קשר"ג');
    
    // Passcode modal
    const passcodeA = pageA.locator('input[placeholder="הכנס סיסמה"]');
    if (await passcodeA.isVisible()) {
      await passcodeA.fill(PASSCODE);
      await pageA.keyboard.press('Enter');
    }
    await pageA.waitForURL('**/report/kashrag');

    console.log('Logging in Kashpal (Context B)...');
    await pageB.goto(URL);
    await pageB.click('text=פלוגה א\'');
    
    const passcodeB = pageB.locator('input[placeholder="הכנס סיסמה"]');
    if (await passcodeB.isVisible()) {
      await passcodeB.fill(PASSCODE);
      await pageB.keyboard.press('Enter');
    }
    await pageB.waitForURL('**/user/platoon');

    // 1. Kashrag starts global session
    console.log('Kashrag starting global session...');
    const startBtn = pageA.locator('text=הפעל דו"ח לכל הפלוגות');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    } else {
      // Maybe a session is already active, let's reset it to be clean
      const resetBtn = pageA.locator('text=איפוס');
      if (await resetBtn.isVisible()) await resetBtn.click();
    }
    
    // 2. Kashpal waits for active banner
    console.log('Kashpal waiting for real-time banner update...');
    await expect(pageB.locator('text=דו"ח פעיל')).toBeVisible({ timeout: 10000 });

    // 3. Kashpal updates a device location
    console.log('Kashpal updating a device location...');
    // Find the first device map-pin icon
    const mapPin = pageB.locator('css=[class*="map-pin"]').first();
    await mapPin.click();
    
    // Fill the location modal
    const locInput = pageB.locator('input[placeholder="לדוגמה: עמדת שמירה צפונית"]');
    const testLocation = 'E2E_Test_Loc_' + Date.now();
    await locInput.fill(testLocation);
    await pageB.click('text=שמור');

    // 4. Kashrag verifies the update in absolute real-time without refreshing
    console.log('Kashrag verifying sync without refresh...');
    // Expand Platoon A accordion if needed
    const accordion = pageA.locator('text=פלוגה א\'').first();
    await accordion.click();
    
    // The device should now display the test location
    const syncedLocation = pageA.locator(`text=${testLocation}`);
    await expect(syncedLocation).toBeVisible({ timeout: 5000 });
    console.log('SUCCESS: Real-time sync verified!');

    // Cleanup
    await pageA.click('text=סיים דו"ח');
    await browser.close();
  });

  test('Phase 2: Network Resilience (Offline State Sync)', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(URL);
    await page.click('text=פלוגה ב\''); // Use a different platoon to avoid conflicts
    
    const passcode = page.locator('input[placeholder="הכנס סיסמה"]');
    if (await passcode.isVisible()) {
      await passcode.fill(PASSCODE);
      await page.keyboard.press('Enter');
    }
    
    // Simulate Offline
    console.log('Simulating Network Drop (Offline mode)...');
    await context.setOffline(true);

    // Try to update location while offline
    const mapPin = page.locator('css=[class*="map-pin"]').first();
    await mapPin.click();
    const testLocation = 'Offline_Test_' + Date.now();
    await page.locator('input[placeholder="לדוגמה: עמדת שמירה צפונית"]').fill(testLocation);
    await page.click('text=שמור');

    // Restore Network
    console.log('Restoring Network Connection...');
    await context.setOffline(false);
    
    // Wait a moment for Firebase to sync queued writes
    await page.waitForTimeout(3000);
    
    // We can open a Kashrag context here to verify the write successfully made it to the cloud
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(URL);
    await adminPage.click('text=קשר"ג');
    if (await adminPage.locator('input[placeholder="הכנס סיסמה"]').isVisible()) {
      await adminPage.locator('input[placeholder="הכנס סיסמה"]').fill(PASSCODE);
      await adminPage.keyboard.press('Enter');
    }
    await adminPage.waitForURL('**/report/kashrag');
    
    const accordion = adminPage.locator('text=פלוגה ב\'').first();
    await accordion.click();
    const syncedLocation = adminPage.locator(`text=${testLocation}`);
    await expect(syncedLocation).toBeVisible({ timeout: 5000 });
    
    console.log('SUCCESS: Offline queue synced successfully upon reconnection!');
    await browser.close();
  });

});
