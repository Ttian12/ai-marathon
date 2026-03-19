import { test, expect } from '@playwright/test';

test.describe('类别A：基础编辑功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('collaborative-doc'));
  });

  test('Test-A1: 文本输入与保存', async ({ page }) => {
    const docId = `a1-${Date.now()}`;
    await page.goto(`/?doc=${docId}`);
    const editor = page.locator('.ql-editor');
    
    // 输入
    await editor.fill('Hello World');
    await expect(editor).toHaveText('Hello World');
    
    // 刷新页面验证持久化 (IndexedDB)
    await page.reload();
    await expect(editor).toHaveText('Hello World');
  });

  test('Test-A2: 格式应用', async ({ page }) => {
    await page.goto(`/?doc=a2-${Date.now()}`);
    const editor = page.locator('.ql-editor');
    
    await editor.fill('HelloWorld');
    
    // 选中 Hello (0-5) 并加粗
    await page.evaluate(() => {
      const quill = (window as any).quill;
      quill.formatText(0, 5, 'bold', true);
    });

    // 选中 World (5-10) 并斜体
    await page.evaluate(() => {
      const quill = (window as any).quill;
      quill.formatText(5, 5, 'italic', true);
    });

    const html = await editor.innerHTML();
    expect(html).toContain('<strong>Hello</strong>');
    expect(html).toContain('<em>World</em>');
  });

  test('Test-A3: 复杂格式组合', async ({ page }) => {
    await page.goto(`/?doc=a3-${Date.now()}`);
    const editor = page.locator('.ql-editor');
    
    await page.evaluate(() => {
      const quill = (window as any).quill;
      quill.setText('');
      quill.insertText(0, '会议记录\n', 'header', 1);
      quill.insertText(5, '讨论事项:\n');
      quill.insertText(11, 'AI编程\n', 'list', 'bullet');
      quill.insertText(16, '技术分享\n', 'list', 'bullet');
      quill.insertText(21, '团建活动\n', 'list', 'bullet');
      quill.insertText(26, 'https://example.com', 'link', 'https://example.com');
    });

    const html = await editor.innerHTML();
    expect(html).toContain('<h1>会议记录</h1>');
    expect(html).toContain('讨论事项:');
    expect(html).toContain('AI编程');
    expect(html).toContain('技术分享');
    expect(html).toContain('团建活动');
    expect(html).toContain('href="https://example.com"');
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
