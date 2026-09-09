import type { Prisma } from '@prisma/client'
import { getProjectFinancialReadiness } from '@/lib/project-workflow'
import { calculateProjectProductionDates } from '@/lib/business-days'

export async function syncProjectReceiptWorkflow(tx: Prisma.TransactionClient, projectId: string) {
  const project = await tx.project.findUnique({ where: { id: projectId }, include: { payments: true } })
  if (!project || project.workflowVersion < 2) return
  const readiness = getProjectFinancialReadiness({ ...project, paymentConfirmedAt: null })
  const paidInitial = project.payments.filter(payment => payment.paidAt && (Number(project.downPayment) > 0 ? payment.type === 'DOWN_PAYMENT' : true))
  const confirmation = readiness.ready && paidInitial.length
    ? new Date(Math.max(...paidInitial.map(payment => payment.paidAt!.getTime()))) : null
  const dates = calculateProjectProductionDates({ approvalDate: confirmation, deliveryBusinessDays: project.deliveryBusinessDays, reminderBusinessDays: project.productionReminderBusinessDays })
  await tx.project.update({ where: { id: projectId }, data: {
    paymentConfirmedAt: confirmation,
    // A later payment or reopening must not silently rewrite the promised dates.
    ...(!project.deliveryDeadlineDate && dates.deliveryDeadlineDate ? {
      deliveryDeadlineDate: dates.deliveryDeadlineDate, productionStartReminderDate: dates.productionStartReminderDate,
      estimatedEndDate: project.estimatedEndDate || dates.deliveryDeadlineDate,
    } : {}),
  } })
}
