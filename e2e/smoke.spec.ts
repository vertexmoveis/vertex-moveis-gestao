import { expect, test } from '@playwright/test'

test('login abre sem erro e exibe os controles de segurança', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/login')

  await expect(page).toHaveTitle(/Vertex Móveis/)
  await expect(page.getByRole('heading', { name: 'Vertex Móveis' })).toBeVisible()
  await expect(page.getByPlaceholder('seu@email.com')).toBeVisible()
  await expect(page.getByPlaceholder('Sua senha')).toBeVisible()
  await expect(page.getByPlaceholder('Código do autenticador, se ativado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  expect(errors).toEqual([])
})

test('dashboard protegido redireciona visitante para o login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('manifesto instalável possui identidade da Vertex', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest.name).toBe('Vertex Móveis - Gestão')
  expect(manifest.start_url).toBe('/dashboard')
  expect(manifest.display).toBe('standalone')
})

test('fluxo autenticado abre dashboard e configurações', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Credenciais E2E não configuradas.')

  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill(process.env.E2E_EMAIL!)
  await page.getByPlaceholder('Sua senha').fill(process.env.E2E_PASSWORD!)
  if (process.env.E2E_OTP) {
    await page.getByPlaceholder('Código do autenticador, se ativado').fill(process.env.E2E_OTP)
  }
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'Projetos' })).toBeVisible()

  await page.goto('/dashboard/settings')
  await expect(page.getByText('Segurança da conta')).toBeVisible()
})
