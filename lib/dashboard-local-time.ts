const DASHBOARD_TIME_ZONE = 'America/Sao_Paulo'

function hourInDashboardTimeZone(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DASHBOARD_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)

  return Number(parts.find((part) => part.type === 'hour')?.value || 0)
}

export function getDashboardGreeting(value = new Date()) {
  const hour = hourInDashboardTimeZone(value)
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function formatDashboardDate(value = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DASHBOARD_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value)
}
