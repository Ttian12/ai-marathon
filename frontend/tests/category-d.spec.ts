import { test, expect } from '@playwright/test';

test.describe('类别D：离线支持功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('collaborative-doc'));
  });

  test('Test-D1: 离线编辑', async ({ page, context }) => {
    const docId = `d1-${Date.now()}`;
    await page.goto(`/?doc=${docId}`);
    await expect(page.getByText('在线', { exact: true })).toBeVisible();

    await page.evaluate(() => (window as any).quill.setText('Online content.'));
    await page.waitForTimeout(500);

    await context.setOffline(true);
    await expect(page.locator('text=离线模式')).toBeVisible();

    await page.evaluate(() => (window as any).quill.setText('Offline edited content.'));

    await context.setOffline(false);
    await expect(page.getByText('在线', { exact: true })).toBeVisible();
    await page.waitForTimeout(1000); 

    await page.reload();
    await expect(page.locator('text=已从本地恢复')).toBeVisible();
    await expect(page.locator('.ql-editor')).toHaveText(/Offline edited content/);

    const page2 = await context.newPage();
    await page2.goto(`/?doc=${docId}`);
    await expect(page2.getByText('在线', { exact: true })).toBeVisible();
    await expect(page2.locator('.ql-editor')).toHaveText(/Offline edited content/);
  });

  test('Test-D2: 离线期间冲突处理', async ({ browser }) => {
    const docId = `d2-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(`/?doc=${docId}`);
    await pageB.goto(`/?doc=${docId}`);

    await pageA.locator('.ql-editor').fill('Init');
    await pageB.waitForTimeout(1000);

    await contextB.setOffline(true);
    await expect(pageB.locator('text=离线模式')).toBeVisible();

    // 用户 A 在线修改
    await pageA.evaluate(() => (window as any).quill.setText('User A edit'));
    await pageA.waitForTimeout(1000);

    // 用户 B 离线修改 (LWW 策略，较晚提交生效)
    await pageB.evaluate(() => (window as any).quill.setText('User B edit'));
    await pageB.waitForTimeout(500);

    await contextB.setOffline(false);
    await expect(pageB.getByText('在线', { exact: true })).toBeVisible();

    await expect(pageA.locator('.ql-editor')).toHaveText(/User B edit/, { timeout: 10000 });
    await expect(pageB.locator('.ql-editor')).toHaveText(/User B edit/, { timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });

  test('Test-D3: 长时间离线恢复', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByText('在线', { exact: true })).toBeVisible();

    await context.setOffline(true);
    await expect(page.locator('text=离线模式')).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await page.locator('.ql-editor').fill(`Long offline edit ${i}`);
      await page.waitForTimeout(200);
    }

    await context.setOffline(false);
    await expect(page.getByText('在线', { exact: true })).toBeVisible();

    await expect(page.locator('.ql-editor')).toHaveText(/Long offline edit 4/, { timeout: 10000 });
  });

  test('Test-D4: 离线状态提示', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByText('在线', { exact: true })).toBeVisible();

    await context.setOffline(true);
    await expect(page.locator('text=离线模式')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText('在线', { exact: true })).toBeVisible();
  });
});
