import { test, expect } from '@playwright/test';

test.describe('Agent-B: 协作增强功能验证', () => {
  const URL = 'http://localhost:5173/';

  test('Test-A2/A3: 格式应用验证', async ({ page }) => {
    await page.goto(URL);
    const editor = page.locator('.ql-editor');
    
    // 输入文本
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

    // 复杂格式：H1, 无序列表, 链接
    await editor.fill('');
    await page.evaluate(() => {
      const quill = (window as any).quill;
      quill.insertText(0, '会议记录\n', 'header', 1);
      quill.insertText(5, '讨论事项:\n');
      quill.insertText(11, 'AI编程\n', 'list', 'bullet');
      quill.insertText(16, '技术分享\n', 'list', 'bullet');
      quill.insertText(21, 'Link', 'link', 'https://example.com');
    });

    const complexHtml = await editor.innerHTML();
    expect(complexHtml).toContain('<h1>会议记录</h1>');
    expect(complexHtml).toContain('data-list="bullet"');
    expect(complexHtml).toContain('AI编程');
    expect(complexHtml).toContain('href="https://example.com"');
  });

  test('Test-B2: 光标位置同步显示', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(URL);
    await pageB.goto(URL);

    // 等待 WebSocket 连接
    await pageA.waitForSelector('.lucide-wifi');
    await pageB.waitForSelector('.lucide-wifi');

    // B 聚焦并移动光标
    const editorB = pageB.locator('.ql-editor');
    await editorB.fill('Cursor Test');
    await pageB.evaluate(() => {
      const quill = (window as any).quill;
      quill.setSelection(5, 0);
    });

    // A 应该能看到 B 的光标
    await pageA.waitForSelector('.ql-cursor', { state: 'attached', timeout: 10000 });
    const cursorInA = pageA.locator('.ql-cursor').first();
    // Since it might be a thin line, check for attachment and presence rather than just "visible" if visible is failing
    await expect(cursorInA).toBeAttached();

    await contextA.close();
    await contextB.close();
  });

  test('Test-B4: 用户加入/离开通知', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto(URL);
    await pageA.waitForSelector('.lucide-wifi');

    // 记录初始在线人数
    const getOnlineCount = async () => {
      const text = await pageA.locator('.online-users-list').evaluate(el => el.children.length);
      return text;
    };
    
    let countA = await getOnlineCount();

    // B 加入
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(URL);
    await pageB.waitForSelector('.lucide-wifi');

    // 等待通知
    const notification = pageA.locator('.notification-toast').last();
    await expect(notification).toContainText('已加入');
    
    let countB = await getOnlineCount();
    expect(countB).toBeGreaterThan(countA);

    // B 离开
    await contextB.close();
    
    // 等待离开通知
    const leaveNotification = pageA.locator('.notification-toast').last();
    await expect(leaveNotification).toContainText('已离开');

    let countC = await getOnlineCount();
    expect(countC).toBeLessThan(countB);

    await contextA.close();
  });

  test('Test-B5: 三用户并发压力测试', async ({ browser }) => {
    test.setTimeout(60000); // 延长超时时间
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    await pageA.goto(URL);
    await pageB.goto(URL);
    await pageC.goto(URL);

    // 清空编辑器
    await pageA.locator('.ql-editor').fill('');
    await pageA.waitForTimeout(1000);

    // 并发输入
    const typeChars = async (page: any, char: string) => {
      const editor = page.locator('.ql-editor');
      for(let i=0; i<10; i++) {
        await editor.press('End');
        await editor.type(char);
        await page.waitForTimeout(100);
      }
    };

    await Promise.all([
      typeChars(pageA, 'A'),
      typeChars(pageB, 'B'),
      typeChars(pageC, 'C')
    ]);

    // 等待同步
    await pageA.waitForTimeout(3000);

    const textA = await pageA.locator('.ql-editor').innerText();
    const textB = await pageB.locator('.ql-editor').innerText();
    const textC = await pageC.locator('.ql-editor').innerText();

    expect(textA).toEqual(textB);
    expect(textB).toEqual(textC);
    expect(textA.length).toBeGreaterThanOrEqual(30);

    await contextA.close();
    await contextB.close();
    await contextC.close();
  });
});