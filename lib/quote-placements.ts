const COMMON_PLACEMENTS = [
  'Parede esquerda',
  'Parede direita',
  'Parede em frente',
  'Canto esquerdo',
  'Canto direito',
  'Centro do ambiente',
  'Outro local',
]

const PLACEMENTS_BY_ENVIRONMENT: Record<string, string[]> = {
  cozinha: [
    'Parede da pia',
    'Parede da geladeira',
    'Parede do fogão ou coifa',
    'Sobre a geladeira',
    'Sobre a coifa',
    'Ilha',
    'Península',
    'Torre lateral',
    'Despensa',
  ],
  banheiro: [
    'Abaixo da bancada ou cuba',
    'Acima da bancada',
    'Parede do espelho',
    'Nicho do box',
    'Torre lateral',
  ],
  dormitorio: [
    'Parede da cabeceira',
    'Parede da TV',
    'Parede da janela',
    'Parede da porta',
    'Ao lado da cama',
  ],
  suite: [
    'Parede da cabeceira',
    'Parede da TV',
    'Parede da janela',
    'Parede da porta',
    'Ao lado da cama',
  ],
  closet: [
    'Parede principal',
    'Parede lateral esquerda',
    'Parede lateral direita',
    'Fundo do closet',
    'Ilha central',
  ],
  sala: [
    'Parede da TV',
    'Parede do sofá',
    'Aparador',
    'Divisória',
    'Entrada da sala',
  ],
  lavanderia: [
    'Parede do tanque',
    'Parede da máquina',
    'Sobre a máquina',
    'Torre lateral',
  ],
  escritorio: [
    'Parede da bancada',
    'Sobre a bancada',
    'Parede lateral',
    'Atrás da mesa',
  ],
}
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function getQuotePlacementSuggestions(environment: string) {
  const key = normalize(environment)
  const specific = Object.entries(PLACEMENTS_BY_ENVIRONMENT)
    .find(([environmentKey]) => key.includes(environmentKey))?.[1] || []

  return [...new Set([...specific, ...COMMON_PLACEMENTS])]
}
