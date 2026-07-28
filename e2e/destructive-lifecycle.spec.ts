import { expect, test, type APIResponse } from '@playwright/test'

function saoPauloDateKey(daysFromToday = 0) {
  const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function expectJson<T>(response: APIResponse, expectedStatus: number) {
  const payload = await response.json().catch(() => ({}))
  expect(response.status(), JSON.stringify(payload)).toBe(expectedStatus)
  return payload as T
}

test('jornada isolada completa da venda ao pós-venda', async ({ page }) => {
  test.skip(process.env.E2E_DESTRUCTIVE !== '1', 'Fluxo destrutivo reservado ao banco isolado.')
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Credenciais E2E não configuradas.')

  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill(process.env.E2E_EMAIL!)
  await page.getByPlaceholder('Sua senha').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })

  const api = page.context().request
  const suffix = Date.now().toString(36)
  const client = await expectJson<{ id: string }>(
    await api.post('/api/clients', {
      data: {
        name: `Cliente Jornada ${suffix}`,
        document: '',
        phone: '11999990000',
        whatsapp: '11999990000',
        email: `jornada-${suffix}@example.local`,
        address: '',
        street: 'Rua Saturno',
        number: '6',
        neighborhood: 'Recanto Vista Alegre',
        city: 'Cotia',
        state: 'SP',
        zipCode: '06702-170',
        notes: 'Criado automaticamente pelo teste isolado.',
      },
    }),
    200,
  )

  const quote = await expectJson<{ id: string; total: number }>(
    await api.post('/api/quotes', {
      data: {
        clientId: client.id,
        title: `Cozinha Jornada ${suffix}`,
        variationType: 'STANDARD',
        variationName: 'Padrão',
        variations: [{ type: 'STANDARD', name: 'Padrão' }],
        syncScope: 'CURRENT',
        status: 'DRAFT',
        validUntil: saoPauloDateKey(15),
        deliveryBusinessDays: 30,
        firstInstallmentDate: saoPauloDateKey(30),
        pricePerM2: 2000,
        materialCostPerM2: 650,
        installationFee: 0,
        marginPercent: 35,
        discount: 0,
        paymentMethod: 'CARD',
        cardInstallments: 2,
        cardDownPayment: 200,
        cardFeePercent: 0,
        notes: 'Teste completo do fluxo comercial.',
        customerNotes: 'Produção após aprovação e pagamento.',
        lossReason: '',
        items: [{
          environment: 'Cozinha',
          environmentName: 'Cozinha',
          description: 'Armário aéreo',
          furnitureType: 'Armário aéreo',
          furnitureModel: '',
          placement: 'Parede principal',
          sourceItemKey: '',
          material: 'MDF',
          finish: 'Branco TX',
          width: 1000,
          height: 800,
          depth: 550,
          difficulty: 'NORMAL',
          calculationMode: 'AREA_M2',
          priceProfile: 'STANDARD',
          manualPrice: 0,
          accessories: [],
          quantity: 1,
          notes: '',
        }],
      },
    }),
    200,
  )
  expect(Number(quote.total)).toBeGreaterThan(0)

  const approval = await expectJson<{ approvalUrl: string }>(
    await api.post(`/api/quotes/${quote.id}/approval-request`, { data: {} }),
    200,
  )
  const approvalToken = new URL(approval.approvalUrl).pathname.split('/').pop()
  expect(approvalToken).toBeTruthy()

  await expectJson(
    await api.post(`/api/public/quote-approvals/${approvalToken}`, {
      data: {
        decision: 'APPROVE',
        respondentName: 'Cliente Jornada',
        acceptedTerms: true,
      },
    }),
    200,
  )

  const conversion = await expectJson<{ project: { id: string; name: string } }>(
    await api.post(`/api/quotes/${quote.id}/convert`, {
      data: {
        paymentConfirmedAt: saoPauloDateKey(),
        downPayment: 200,
        installmentCount: 2,
        firstInstallmentDate: saoPauloDateKey(30),
        downPaymentDate: saoPauloDateKey(),
      },
    }),
    200,
  )
  const projectId = conversion.project.id

  const project = await expectJson<{
    payments: Array<{ id: string; type: string; paidAt: string | null }>
  }>(await api.get(`/api/projects/${projectId}`), 200)
  const installment = project.payments.find((payment) => payment.type === 'INSTALLMENT' && !payment.paidAt)
  expect(installment).toBeTruthy()

  await expectJson(
    await api.patch(`/api/projects/${projectId}/payments/${installment!.id}`, {
      data: { paid: true, paymentMethod: 'PIX' },
    }),
    200,
  )
  await expectJson(
    await api.patch(`/api/projects/${projectId}/payments/${installment!.id}`, {
      data: { paid: false },
    }),
    200,
  )

  const contract = await expectJson<{ url: string }>(
    await api.post(`/api/projects/${projectId}/contracts`, { data: {} }),
    201,
  )
  const contractToken = new URL(contract.url).pathname.split('/').pop()
  await expectJson(
    await api.post(`/api/public/contracts/${contractToken}`, {
      data: { signatoryName: 'Cliente Jornada', acceptedTerms: true },
    }),
    200,
  )

  const warranty = await expectJson<{ id: string }>(
    await api.post(`/api/projects/${projectId}/warranty`, {
      data: {
        title: 'Regular porta',
        description: 'Chamado criado pelo teste completo.',
        priority: 'NORMAL',
      },
    }),
    201,
  )
  await expectJson(
    await api.patch(`/api/projects/${projectId}/warranty/${warranty.id}`, {
      data: { status: 'RESOLVED', resolution: 'Porta regulada no teste.' },
    }),
    200,
  )

  await expectJson(
    await api.patch(`/api/projects/${projectId}`, {
      data: { stage: 'COMPLETED' },
    }),
    200,
  )

  await page.goto(`/dashboard/projects/${projectId}`)
  await expect(page.getByRole('heading', { name: conversion.project.name })).toBeVisible()
  await expect(page.getByText('Contrato digital', { exact: true })).toBeVisible()
  await expect(page.getByText('Chamados de garantia', { exact: true })).toBeVisible()
  await expect(page.getByText('Aceito', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible()
})
