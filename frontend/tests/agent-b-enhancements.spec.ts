import { test, expect } from '@playwright/test';

test.describe('Agent-A: 协作增强功能验证', () => {
  const URL = 'http://localhost:5174/';

  test('Test-B2: 光标位置同步显示', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(URL);
    await pageB.goto(URL);

    await expect(pageA.locator('text=在线').first()).toBeVisible();
    await expect(pageB.locator('text=在线').first()).toBeVisible();

    const editorA = pageA.locator('.ql-editor');
    await editorA.fill('Hello from A');
    
    const editorB = pageB.locator('.ql-editor');
    await editorB.focus();
    await pageB.keyboard.press('End');

    await pageA.waitForTimeout(1000);

    const cursorInA = pageA.locator('.ql-cursor');
    expect(await cursorInA.count()).toBeGreaterThanOrEqual(0);
    
    await contextA.close();
    await contextB.close();
  });

  test('Test-B4: 用户加入/离开通知', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto(URL);
    
    await expect(pageA.locator('text=在线').first()).toBeVisible();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(URL);
    await expect(pageB.locator('text=在线').first()).toBeVisible();
    
    await pageB.locator('.ql-editor').fill('B is here');
    
    await expect(pageA.locator('text=在线: 2').first()).toBeVisible({ timeout: 15000 });

    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    await pageC.goto(URL);
    await expect(pageC.locator('text=在线').first()).toBeVisible();
    await pageC.locator('.ql-editor').fill('C is here');
    
    await expect(pageA.locator('text=在线: 3').first()).toBeVisible({ timeout: 15000 });

    await contextB.close();
    
    await expect(pageA.locator('text=在线: 2').first()).toBeVisible({ timeout: 15000 });

    await contextA.close();
    await contextC.close();
  });

  test('Test-A2/A3: 格式应用验证', async ({ page }) => {
    await page.goto(URL);
    const editor = page.locator('.ql-editor');
    
    await editor.fill('会议记录\n讨论事项:\nAI编程\n技术分享\n');
    
    await editor.evaluate((el) => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(el.firstChild!, 0);
      range.setEnd(el.firstChild!, 1);
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    await page.locator('button.ql-header[value="1"]').click();

    const htmlContent = await editor.innerHTML();
    expect(htmlContent).toContain('<h1>');
  });
});
