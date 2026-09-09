import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPaymentSchedule, reconcilePaymentSchedule } from '../lib/payments'
import { getProjectFinancialReadiness } from '../lib/project-workflow'
import { technicalApprovalReady, technicalFileSnapshot } from '../lib/technical-approval'
import { quoteRequestSchema, requestProgressSchema, requestScope } from '../lib/quote-requests'
import { getProjectPhaseBlockers, getProjectPhaseTasks, getProjectTransitionBlockers } from '../lib/project-phases'

test('fechamento gera entrada e parcelas a receber sem fabricar um recebimento', () => {
  const schedule = buildPaymentSchedule({ value: 15000.01, downPayment: 5000, installmentCount: 3, markDownPaymentReceived: false })
  assert.equal(schedule.payments.length, 4)
  assert.ok(schedule.payments.every(payment => payment.paidAt === null))
  assert.equal(Math.round(schedule.payments.reduce((sum, payment) => sum + payment.amount, 0) * 100), 1500001)
  const readiness = getProjectFinancialReadiness({ workflowVersion: 2, downPayment: 5000, paymentConfirmedAt: new Date(), payments: schedule.payments })
  assert.equal(readiness.ready, false)
  schedule.payments[0].paidAt = new Date()
  assert.equal(getProjectFinancialReadiness({ workflowVersion: 2, downPayment: 5000, payments: schedule.payments }).ready, true)
})

test('condição sem entrada permite preparar fabricação, sem quitar parcelas futuras', () => {
  const payments = buildPaymentSchedule({ value: 6000, downPayment: 0, installmentCount: 3, markDownPaymentReceived: false }).payments
  assert.equal(getProjectFinancialReadiness({ workflowVersion: 2, initialPaymentRequired: false, downPayment: 0, payments }).ready, true)
  assert.equal(getProjectFinancialReadiness({ workflowVersion: 2, initialPaymentRequired: true, downPayment: 0, payments }).ready, false)
  assert.ok(payments.every(payment => !payment.paidAt))
})

test('editar o plano não transforma entrada pendente em recebida', () => {
  const old = buildPaymentSchedule({ value: 10000, downPayment: 3000, installmentCount: 2, markDownPaymentReceived: false })
  const next = buildPaymentSchedule({ value: 11000, downPayment: 3000, installmentCount: 2, markDownPaymentReceived: false })
  const result = reconcilePaymentSchedule(next, old.payments.map((payment, index) => ({ ...payment, id: String(index) })))
  assert.ok(result.updates.every(payment => !payment.paidAt))
})

const files = [{ id: 'technical-v1', category: 'TECHNICAL_PROJECT', securityStatus: 'TYPE_CHECKED' }, { id: 'measurement', category: 'MEASUREMENT', securityStatus: 'CLEAN' }]
test('aceite do orçamento não aprova o desenho técnico de projetos novos', () => {
  assert.equal(technicalApprovalReady({ workflowVersion: 2, approvalDate: new Date(), files }), false)
  assert.equal(technicalApprovalReady({ workflowVersion: 1, approvalDate: new Date(), files }), true)
})
test('trocar arquivos exige nova aprovação, fotos operacionais não invalidam o aceite', () => {
  const approved = { workflowVersion: 2, technicalApprovedAt: new Date(), technicalApprovalSnapshot: technicalFileSnapshot(files), files }
  assert.equal(technicalApprovalReady(approved), true)
  assert.equal(technicalApprovalReady({ ...approved, files: [...files, { id: 'photo', category: 'PRODUCTION', securityStatus: 'CLEAN' }] }), true)
  assert.equal(technicalApprovalReady({ ...approved, files: [{ ...files[0], id: 'technical-v2' }] }), false)
  assert.equal(technicalApprovalReady({ ...approved, files: [{ ...files[0], securityStatus: 'REJECTED' }] }), false)
  assert.equal(technicalApprovalReady({ ...approved, files: [{ ...files[0], expiresAt: '2000-01-01' }] }), false)
})
test('preparação exige aprovação técnica separada mesmo com contrato e entrada conferidos', () => {
  const tasks = getProjectPhaseTasks({ workflowVersion: 2, stage: 'PENDING_START', createdAt: '2026-09-09', approvalDate: '2026-09-09', contractStatus: 'SIGNED', downPayment: 1000, payments: [{ type: 'DOWN_PAYMENT', amount: 1000, paidAt: '2026-09-09' }], environments: [{ status: 'PENDING' }], files }, 'PREPARATION')
  assert.ok(getProjectPhaseBlockers(tasks).includes('Aprovação técnica do cliente registrada'))
})

test('saltar da preparação para concluído também confere fabricação e instalação', () => {
  const blockers = getProjectTransitionBlockers({ workflowVersion: 2, stage: 'PENDING_START', createdAt: '2026-09-09', contractStatus: 'NONE', payments: [], environments: [{ status: 'PENDING' }], files }, 'COMPLETED')
  assert.ok(blockers.includes('Aprovação técnica do cliente registrada'))
  assert.ok(blockers.includes('Todos os ambientes prontos para instalar'))
  assert.ok(blockers.includes('Todos os ambientes instalados e conferidos'))
})
test('solicitação requer responsável, briefing, prazo válido e links seguros', () => {
  const data = { clientId: 'client', assignedToId: 'user', title: 'Cozinha', briefing: 'Cozinha com ilha e lavanderia.', environments: 'Cozinha', commercialOwner: 'Comercial', dueDate: '2026-09-12' }
  assert.equal(quoteRequestSchema.safeParse(data).success, true)
  assert.equal(quoteRequestSchema.safeParse({ ...data, assignedToId: '' }).success, false)
  assert.equal(quoteRequestSchema.safeParse({ ...data, dueDate: '2026-02-30' }).success, false)
  assert.equal(quoteRequestSchema.safeParse({ ...data, opportunityUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(quoteRequestSchema.safeParse({ ...data, referenceUrl: 'https://user:password@example.com' }).success, false)
})
test('pendência e cancelamento exigem explicação; acesso fica restrito à equipe responsável', () => {
  const base = { updatedAt: new Date().toISOString() }
  assert.equal(requestProgressSchema.safeParse({ ...base, status: 'MISSING_INFO' }).success, false)
  assert.equal(requestProgressSchema.safeParse({ ...base, status: 'CANCELLED' }).success, false)
  assert.equal(requestProgressSchema.safeParse({ ...base, status: 'MISSING_INFO', missingInformation: 'Medidas da parede.' }).success, true)
  assert.deepEqual(requestScope({ role: 'MANAGER', id: 'a' }), { OR: [{ assignedToId: 'a' }, { createdById: 'a' }] })
})
