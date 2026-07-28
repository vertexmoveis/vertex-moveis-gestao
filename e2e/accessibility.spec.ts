import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('login não possui violações críticas de acessibilidade', async ({ page }) => {
  await page.goto('/login')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  const serious = results.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ))
  expect(serious).toEqual([])
})

test('login cabe no celular sem rolagem horizontal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Verificação exclusiva do projeto móvel.')
  await page.goto('/login')
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
})

test('endpoint público de saúde responde sem expor detalhes internos', async ({ request }) => {
  const response = await request.get('/api/public/health')
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload.status).toBe('ok')
  expect(payload.service).toBe('vertex-moveis')
  expect(payload).not.toHaveProperty('databaseUrl')
})
