export const ORDER_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Solicitado', MISSING_INFO: 'Falta informação', IN_PROGRESS: 'Em elaboração',
  READY: 'Pronto para enviar', DRAFT: 'Em elaboração', SENT: 'Enviado',
  WAITING_APPROVAL: 'Aguardando aprovação', APPROVED: 'Aprovado', SOLD: 'Vendido',
  LOST: 'Perdido', CANCELLED: 'Cancelado',
}
export type CommercialOrder = {
  id: string; title: string; clientId: string; clientName: string; ownerId: string | null; ownerName: string;
  requestId: string | null; quoteId: string | null; projectId: string | null;
  status: string; deadline: string | null; deadlineKind: string; updatedAt: string;
  amount: number | null; variantCount: number; restricted: boolean; archived: boolean; flag: string | null;
}
export type CommercialResult = {
  items: CommercialOrder[]; total: number; owners: { id: string; name: string }[];
  counts: { all: number; active: number; closed: number };
}
