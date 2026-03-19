import { test, expect } from '@playwright/test';

test.describe('类别B：实时协作功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('collaborative-doc'));
  });

  test('Test-B1: 双用户并发编辑', async ({ browser }) => {
    const docId = `b1-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(`/?doc=${docId}`);
    await pageB.goto(`/?doc=${docId}`);

    const editorA = pageA.locator('.ql-editor');
    const editorB = pageB.locator('.ql-editor');

    await editorA.fill('Hello');
    await pageB.waitForTimeout(1000);
    await expect(editorB).toHaveText('Hello');

    await pageB.evaluate(() => {
      const quill = (window as any).quill;
      quill.insertText(5, 'World');
    });
    
    await pageA.waitForTimeout(1000);
    await expect(editorA).toHaveText('HelloWorld');
    await expect(editorB).toHaveText('HelloWorld');

    await contextA.close();
    await contextB.close();
  });

  test('Test-B2: 光标位置显示', async ({ browser }) => {
    const docId = `b2-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(`/?doc=${docId}`);
    await pageB.goto(`/?doc=${docId}`);

    await pageB.evaluate(() => {
      const quill = (window as any).quill;
      quill.setText('Cursor Test');
      quill.setSelection(5, 0);
    });

    await pageA.waitForSelector('.ql-cursor', { state: 'attached', timeout: 10000 });
    const cursorInA = pageA.locator('.ql-cursor').first();
    await expect(cursorInA).toBeAttached();

    await contextA.close();
    await contextB.close();
  });

  test('Test-B3: 冲突编辑解决', async ({ browser }) => {
    const docId = `b3-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(`/?doc=${docId}`);
    await pageB.goto(`/?doc=${docId}`);

    await pageA.locator('.ql-editor').fill('xxxxx');
    await pageB.waitForTimeout(1000);

    // 用户 A 在位置 5 插入 "123"
    // 用户 B 在位置 5 插入 "456"
    await Promise.all([
      pageA.evaluate(() => (window as any).quill.insertText(5, '123')),
      pageB.evaluate(() => (window as any).quill.insertText(5, '456'))
    ]);

    await pageA.waitForTimeout(2000);
    const textA = await pageA.locator('.ql-editor').innerText();
    const textB = await pageB.locator('.ql-editor').innerText();

    expect(textA).toEqual(textB);
    expect(textA).toMatch(/xxxxx(123456|456123)/);

    await contextA.close();
    await contextB.close();
  });

  test('Test-B4: 用户加入/离开通知', async ({ browser }) => {
    const docId = `b4-${Date.now()}`;
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto(`/?doc=${docId}`);
    await pageA.waitForSelector('.lucide-wifi');

    // B 加入
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(`/?doc=${docId}`);
    await pageA.waitForSelector('.notification-toast:has-text("已加入")');
    
    // C 加入
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    await pageC.goto(`/?doc=${docId}`);
    await pageA.waitForSelector('.notification-toast:has-text("已加入")');

    // 检查在线人数
    await expect(pageA.getByText('在线: 3')).toBeVisible();

    // B 离开
    await contextB.close();
    await pageA.waitForSelector('.notification-toast:has-text("已离开")');
    await expect(pageA.getByText('在线: 2')).toBeVisible();

    await contextA.close();
    await contextC.close();
  });

  test('Test-B5: 三用户并发压力测试', async ({ browser }) => {
    const docId = `b5-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    await pageA.goto(`/?doc=${docId}`);
    await pageB.goto(`/?doc=${docId}`);
    await pageC.goto(`/?doc=${docId}`);

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
