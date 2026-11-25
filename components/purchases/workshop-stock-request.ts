export class WorkshopStockRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function workshopStockRequest<T>(path = '', options?: RequestInit): Promise<T> {
  const fallback = options?.method === 'POST'
    ? 'Não foi possível concluir a operação. Confira a conexão e tente de novo.'
    : 'Não foi possível carregar o estoque.'
  const response = await fetch(`/api/workshop-stock${path}`, { cache: 'no-store', ...options })
    .catch(() => { throw new Error(fallback) })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new WorkshopStockRequestError(data?.error || fallback, response.status)
  return data
}
