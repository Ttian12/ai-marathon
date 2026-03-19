import { test, expect } from '@playwright/test'

test.describe('Agent-C Tests: Offline Support', () => {
  test('Test-D1: Offline editing and sync', async ({ page, context }) => {
    await page.goto('http://localhost:5175')
    await expect(page.getByText('在线', { exact: true })).toBeVisible()

    await page.locator('.ql-editor').fill('Online content.')
    await page.waitForTimeout(500)

    await context.setOffline(true)
    await expect(page.locator('text=离线模式')).toBeVisible()

    await page.locator('.ql-editor').fill('Offline edited content.')

    await context.setOffline(false)
    await expect(page.getByText('在线', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.locator('text=已从本地恢复')).toBeVisible()
    await expect(page.locator('.ql-editor')).toHaveText(/Offline edited content/)

    const page2 = await context.newPage()
    await page2.goto('http://localhost:5175')
    await expect(page2.getByText('在线', { exact: true })).toBeVisible()
    await expect(page2.locator('.ql-editor')).toHaveText(/Offline edited content/)
  })

  test('Test-D4: Offline status UI', async ({ page, context }) => {
    await page.goto('http://localhost:5175')
    await expect(page.getByText('在线', { exact: true })).toBeVisible()

    await context.setOffline(true)
    await expect(page.locator('text=离线模式')).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText('在线', { exact: true })).toBeVisible()
  })

})
