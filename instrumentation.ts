import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[Vertex request error]', {
    message,
    method: request.method,
    route: context.routePath,
    type: context.routeType,
  })

  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { recordSystemEvent } = await import('./lib/system-events')
  await recordSystemEvent({
    type: 'SERVER_ERROR',
    severity: 'ERROR',
    source: context.routeType,
    message,
    details: {
      method: request.method,
      route: context.routePath,
      router: context.routerKind,
    },
  })
}
