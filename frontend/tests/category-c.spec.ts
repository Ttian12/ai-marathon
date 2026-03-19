import { test, expect } from '@playwright/test';

test.describe('类别C：版本历史功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('collaborative-doc'));
  });

  test('Test-C1: 版本自动保存', async ({ page }) => {
    const doc = `c1-${Date.now()}`;
    await page.goto(`/?doc=${doc}`);
    const editor = page.locator('.ql-editor');

    // 连续编辑 5 次，每次间隔 4s (总计 20s)，后端每 3s 检查一次
    for (let i = 1; i <= 5; i++) {
      await editor.fill(`Content version ${i}`);
      await page.waitForTimeout(4000);
    }

    // 打开版本历史
    await page.click('button[title="版本历史"]');
    await page.waitForSelector('.divide-y div');

    // 验证至少有 3 个版本
    const versions = page.locator('.divide-y > div');
    const count = await versions.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Test-C2: 版本内容正确性', async ({ page }) => {
    const doc = `c2-${Date.now()}`;
    await page.goto(`/?doc=${doc}`);
    const editor = page.locator('.ql-editor');

    // 第 1 次编辑
    await editor.fill('版本1');
    await page.waitForTimeout(4000); // 等待自动保存 (saveInterval=3s)

    // 第 2 次编辑
    await editor.fill('版本2');
    await page.waitForTimeout(4000);

    // 打开历史
    await page.click('button[title="版本历史"]');
    await page.waitForSelector('.divide-y div');

    // 检查历史列表中的内容
    const historyTexts = await page.locator('.divide-y p').allTextContents();
    expect(historyTexts.some(t => t.includes('版本1'))).toBeTruthy();
    expect(historyTexts.some(t => t.includes('版本2'))).toBeTruthy();
  });

  test('Test-C3: 版本回滚功能', async ({ page, browser }) => {
    const doc = `c3-${Date.now()}`;
    
    // 用户 A 创建版本
    await page.goto(`/?doc=${doc}`);
    const editorA = page.locator('.ql-editor');
    await editorA.fill('旧内容');
    await page.waitForTimeout(4000); // 等待保存

    // 修改为最新内容
    await editorA.fill('最新内容');
    await page.waitForTimeout(4000);

    // 用户 B 同时在线
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(`/?doc=${doc}`);
    await expect(pageB.locator('.ql-editor')).toHaveText('最新内容');

    // 用户 A 执行回滚
    await page.click('button[title="版本历史"]');
    await page.waitForSelector('.divide-y div');
    
    // 点击包含 "旧内容" 的版本的回滚按钮
    const rollbackBtn = page.locator('.group', { hasText: '旧内容' }).locator('button', { hasText: '回滚' });
    await rollbackBtn.click();

    // 验证 A 的内容已回滚
    await expect(editorA).toHaveText('旧内容');

    // 验证 B 实时看到回滚内容
    await expect(pageB.locator('.ql-editor')).toHaveText('旧内容');

    await contextB.close();
  });

  test('Test-C4: 版本数量上限', async ({ page }) => {
    const doc = `c4-${Date.now()}`;
    await page.goto(`/?doc=${doc}`);
    const editor = page.locator('.ql-editor');

    // 快速产生多个版本
    // 注意：后端 saveInterval=3s 且只有内容变化才保存
    for (let i = 1; i <= 5; i++) {
      await editor.fill(`Version limit test ${i}`);
      await page.waitForTimeout(3500);
    }

    await page.click('button[title="版本历史"]');
    await page.waitForSelector('.divide-y div');
    const count = await page.locator('.divide-y > div').count();
    expect(count).toBeLessThanOrEqual(50);
  });
});
