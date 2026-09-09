export type TechnicalFile = { id?: string; category: string; securityStatus?: string; expiresAt?: Date | string | null }
export function technicalFileSnapshot(files: TechnicalFile[]) {
  return JSON.stringify(files.filter(file => file.category === 'TECHNICAL_PROJECT').map(file => file.id || '').sort())
}
export function technicalApprovalReady(input: {
  workflowVersion?: number; approvalDate?: Date | string | null; technicalApprovedAt?: Date | string | null;
  technicalApprovalSnapshot?: string | null; files: TechnicalFile[];
}) {
  if ((input.workflowVersion ?? 1) < 2) return Boolean(input.approvalDate)
  const files = input.files.filter(file => file.category === 'TECHNICAL_PROJECT')
  return Boolean(input.technicalApprovedAt && files.length && files.every(file => file.id
    && ['CLEAN', 'TYPE_CHECKED'].includes(file.securityStatus || '') && (!file.expiresAt || new Date(file.expiresAt).getTime() > Date.now()))
    && input.technicalApprovalSnapshot === technicalFileSnapshot(files))
}

export const technicalApprovalSelect = {
  initialPaymentRequired: true,
  workflowVersion: true, technicalApprovedAt: true, technicalApprovalSnapshot: true,
  technicalApprovalCustomer: true, technicalApprovalEvidence: true, technicalApprovalRecordedBy: true,
} as const
