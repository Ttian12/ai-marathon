import { test, expect } from '@playwright/test'

test.describe('Agent-C Tests: Extra', () => {
  test('Test-D2: Offline conflict resolution (LWW)', async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await pageA.goto('/')
    await pageB.goto('/')

    await expect(pageA.getByText('在线', { exact: true })).toBeVisible()
    await expect(pageB.getByText('在线', { exact: true })).toBeVisible()
    await expect(pageA.locator('text=已从本地恢复')).toBeVisible()
    await expect(pageB.locator('text=已从本地恢复')).toBeVisible()
    await expect(pageA.locator('.ql-editor')).toBeVisible()
    await expect(pageB.locator('.ql-editor')).toBeVisible()

    await pageA.locator('.ql-editor').fill('Init')
    await expect(pageA.locator('.ql-editor')).toHaveText(/Init/)
    await expect(pageB.locator('.ql-editor')).toHaveText(/Init/, { timeout: 10000 })

    await contextB.setOffline(true)
    await expect(pageB.locator('text=离线模式')).toBeVisible()

    await pageA.locator('.ql-editor').fill('User A edit')
    await pageA.waitForTimeout(1000)

    await pageB.locator('.ql-editor').fill('User B edit')

    await contextB.setOffline(false)
    await expect(pageB.getByText('在线', { exact: true })).toBeVisible()

    await expect(pageA.locator('.ql-editor')).toHaveText(/User B edit/, { timeout: 10000 })
    await expect(pageB.locator('.ql-editor')).toHaveText(/User B edit/, { timeout: 10000 })

    await contextA.close()
    await contextB.close()
  })

  test('Test-D3: Long offline recovery', async ({ page, context }) => {
    await page.goto('/')
    await expect(page.getByText('在线', { exact: true })).toBeVisible()

    await context.setOffline(true)
    await expect(page.locator('text=离线模式')).toBeVisible()

    for (let i = 0; i < 5; i++) {
      await page.locator('.ql-editor').fill(`Long offline edit ${i}`)
      await page.waitForTimeout(200)
    }

    await context.setOffline(false)
    await expect(page.getByText('在线', { exact: true })).toBeVisible()

    await expect(page.locator('.ql-editor')).toHaveText(/Long offline edit 4/, { timeout: 10000 })
  })
})
