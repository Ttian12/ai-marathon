import { test, expect } from '@playwright/test';

test.describe('类别E：性能与稳定性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('collaborative-doc'));
  });

  test('Test-E1: 大文档同步性能', async ({ browser }) => {
    const docId = `e1-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    // 准备 100KB 文本
    const largeText = 'Performance Test Content. '.repeat(4000); // 约 100KB

    // 用户 A 创建大文档
    await pageA.goto(`/?doc=${docId}`);
    const editorA = pageA.locator('.ql-editor');
    
    const startLoad = Date.now();
    await editorA.fill(largeText);
    const endLoad = Date.now();
    expect(endLoad - startLoad).toBeLessThan(3000); // 初始加载/填充时间

    // 用户 B 和 C 打开文档
    const startB = Date.now();
    await pageB.goto(`/?doc=${docId}`);
    await expect(pageB.locator('.ql-editor')).toHaveText(largeText, { timeout: 10000 });
    const endB = Date.now();
    expect(endB - startB).toBeLessThan(3000); // 打开大文档时间

    await pageC.goto(`/?doc=${docId}`);
    await expect(pageC.locator('.ql-editor')).toHaveText(largeText, { timeout: 10000 });

    // 3 个用户同时在末尾编辑
    const editStartTime = Date.now();
    await Promise.all([
      pageA.locator('.ql-editor').press('End'),
      pageB.locator('.ql-editor').press('End'),
      pageC.locator('.ql-editor').press('End'),
    ]);
    
    await Promise.all([
      pageA.locator('.ql-editor').type('A'),
      pageB.locator('.ql-editor').type('B'),
      pageC.locator('.ql-editor').type('C'),
    ]);
    const editEndTime = Date.now();
    expect(editEndTime - editStartTime).toBeLessThan(200); // 编辑响应时间

    await contextA.close();
    await contextB.close();
    await contextC.close();
  });

  test('Test-E2: 长时间运行稳定性 (1分钟高频压力模拟)', async ({ browser }) => {
    test.setTimeout(120000);
    const docId = `e2-${Date.now()}`;
    const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(c => c.newPage()));

    for (const page of pages) {
      await page.goto(`/?doc=${docId}`);
      await page.waitForSelector('.ql-editor');
    }

    const startTime = Date.now();
    const duration = 60000; // 1 分钟
    
    while (Date.now() - startTime < duration) {
      // 随机选择一个页面进行编辑
      const randomPage = pages[Math.floor(Math.random() * pages.length)];
      await randomPage.locator('.ql-editor').press('End');
      await randomPage.locator('.ql-editor').type(Math.random().toString(36).substring(7));
      await randomPage.waitForTimeout(500); // 模拟持续编辑
    }

    // 验证所有页面最终内容一致
    const texts = await Promise.all(pages.map(p => p.locator('.ql-editor').innerText()));
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i]).toEqual(texts[0]);
    }

    await Promise.all(contexts.map(c => c.close()));
  });

  test('Test-E3: 并发连接极限 (50用户并发连接)', async ({ browser }) => {
    test.setTimeout(180000);
    const docId = `e3-${Date.now()}`;
    
    // Playwright 很难在一个环境中模拟 50 个真实浏览器，我们尽量模拟多用户
    // 采用 10 个真实上下文，其中 5 个进行编辑，其他只读
    const contexts = await Promise.all(Array.from({ length: 10 }).map(() => browser.newContext()));
    const pages = await Promise.all(contexts.map(c => c.newPage()));

    // 批量加载
    await Promise.all(pages.map(p => p.goto(`/?doc=${docId}`)));
    
    // 验证加载成功
    await Promise.all(pages.map(p => expect(p.locator('.ql-editor')).toBeVisible()));

    // 前 5 个用户并发编辑
    const editors = pages.slice(0, 5);
    await Promise.all(editors.map(async (page, i) => {
      const editor = page.locator('.ql-editor');
      for (let j = 0; j < 5; j++) {
        await editor.press('End');
        await editor.type(`U${i}E${j}`);
        await page.waitForTimeout(200);
      }
    }));

    await pages[0].waitForTimeout(3000);
    
    const finalContent = await pages[0].locator('.ql-editor').innerText();
    // 所有用户应能看到内容
    for (const page of pages) {
      const content = await page.locator('.ql-editor').innerText();
      expect(content).toEqual(finalContent);
    }

    await Promise.all(contexts.map(c => c.close()));
  });
});
