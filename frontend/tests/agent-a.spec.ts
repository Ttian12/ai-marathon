import { test, expect } from '@playwright/test';

test.describe('Agent-A: 核心编辑与同步功能验证', () => {
  test('Test-A1: 文本输入与基本显示', async ({ page }) => {
    await page.goto(`/?doc=a1-${Date.now()}`);
    const editor = page.locator('.ql-editor');
    await editor.fill('Hello World');
    await expect(editor).toHaveText('Hello World');
  });

  test('Test-B1: 双用户并发编辑同步', async ({ browser }) => {
    const doc = `b1-${Date.now()}`
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(`/?doc=${doc}`);
    await pageB.goto(`/?doc=${doc}`);

    const editorA = pageA.locator('.ql-editor');
    const editorB = pageB.locator('.ql-editor');

    await editorA.fill('Hello from A');
    await pageB.waitForTimeout(1000);
    await expect(editorB).toHaveText('Hello from A');

    await editorB.focus();
    await pageB.keyboard.press('End');
    await pageB.keyboard.type(' and B');
    
    await pageA.waitForTimeout(1000);
    await expect(editorA).toHaveText('Hello from A and B');

    await contextA.close();
    await contextB.close();
  });

  test('Test-A4: 大文本处理', async ({ page }) => {
    await page.goto(`/?doc=a4-${Date.now()}`);
    const editor = page.locator('.ql-editor');
    const largeText = 'A'.repeat(10000);
    
    const startTime = Date.now();
    await editor.fill(largeText);
    const endTime = Date.now();
    
    await expect(editor).toHaveText(largeText);
    expect(endTime - startTime).toBeLessThan(500);
  });
});
