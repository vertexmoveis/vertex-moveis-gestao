export type ClientAddressParts = {
  address?: string | null
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

function clean(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

export function formatClientAddress(client: ClientAddressParts) {
  const streetLine = [clean(client.street), clean(client.number)].filter(Boolean).join(', ')
  const cityLine = [clean(client.neighborhood), clean(client.city), clean(client.state)].filter(Boolean).join(', ')
  const zipLine = clean(client.zipCode)
  const structured = [streetLine, cityLine, zipLine].filter(Boolean).join(' - ')

  return structured || clean(client.address)
}
