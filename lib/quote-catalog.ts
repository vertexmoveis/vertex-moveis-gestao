export type QuoteCalculationMode = 'AREA_M2' | 'LINEAR_METER' | 'UNIT'

export type QuoteFurnitureGroup = {
  type: string
  models: readonly string[]
  suggestedMode?: QuoteCalculationMode
  accessories?: readonly string[]
}

const STANDARD_ACCESSORIES = [
  'Iluminação LED',
  'Tomada embutida',
  'Passa-fios',
  'Puxador especial',
  'Fechamento suave',
] as const

const CABINET_ACCESSORIES = [
  ...STANDARD_ACCESSORIES,
  'Gaveta interna',
  'Divisória interna',
  'Prateleira extra',
  'Porta basculante',
  'Porta de correr',
] as const

const WARDROBE_ACCESSORIES = [
  ...STANDARD_ACCESSORIES,
  'Cabideiro',
  'Calceiro',
  'Camiseiro',
  'Sapateira interna',
  'Porta-joias',
  'Espelho interno',
] as const

const group = (
  type: string,
  models: readonly string[],
  accessories: readonly string[] = STANDARD_ACCESSORIES,
  suggestedMode: QuoteCalculationMode = 'AREA_M2'
): QuoteFurnitureGroup => ({ type, models, accessories, suggestedMode })

export const QUOTE_FURNITURE_CATALOG: Record<string, readonly QuoteFurnitureGroup[]> = {
  Cozinha: [
    group('Armário', ['Armário aéreo', 'Armário aéreo em L', 'Armário aéreo basculante', 'Armário aéreo de canto', 'Armário aéreo com nicho', 'Armário aéreo com portas de vidro', 'Armário sobre geladeira', 'Ponte sobre geladeira', 'Armário inferior', 'Armário inferior em L', 'Armário inferior de canto'], CABINET_ACCESSORIES),
    group('Gabinete', ['Gabinete de pia', 'Gabinete em L', 'Gabinete em U', 'Gabinete de canto', 'Gabinete para cooktop', 'Gabinete para lava-louças', 'Gabinete com portas', 'Gabinete com gavetas', 'Gabinete com gaveteiro'], [...CABINET_ACCESSORIES, 'Lixeira embutida', 'Organizador de panelas']),
    group('Torre', ['Torre quente', 'Torre para forno', 'Torre para micro-ondas', 'Torre para forno e micro-ondas', 'Torre de eletrodomésticos', 'Torre despenseiro', 'Torre para geladeira'], CABINET_ACCESSORIES),
    group('Armazenamento', ['Paneleiro', 'Despenseiro', 'Gaveteiro', 'Gaveteiro avulso', 'Gaveteiro de cozinha', 'Gaveteiro com rodízios', 'Porta-temperos', 'Fruteira planejada'], [...CABINET_ACCESSORIES, 'Cesto aramado', 'Organizador de talheres']),
    group('Balcão e bancada', ['Balcão com portas', 'Balcão com gavetas', 'Balcão com gaveteiro', 'Balcão em L', 'Balcão de canto', 'Balcão para refeições', 'Bancada de apoio', 'Península'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
    group('Ilha', ['Ilha com armários', 'Ilha com gavetas', 'Ilha para cooktop', 'Ilha para refeições'], [...CABINET_ACCESSORIES, 'Tomada torre'], 'LINEAR_METER'),
    group('Cristaleira e adega', ['Cristaleira', 'Adega', 'Bar de cozinha', 'Porta-garrafas'], [...STANDARD_ACCESSORIES, 'Porta-taças']),
    group('Nicho e prateleira', ['Nicho decorativo', 'Nicho para micro-ondas', 'Nicho para eletrodoméstico', 'Prateleira'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  Banheiro: [
    group('Gabinete', ['Gabinete de cuba', 'Gabinete em L', 'Gabinete de canto', 'Gabinete suspenso', 'Gabinete de piso', 'Gabinete para cuba dupla', 'Gabinete com gavetas', 'Gabinete com gaveteiro'], [...CABINET_ACCESSORIES, 'Cesto de roupas']),
    group('Armário', ['Armário aéreo', 'Armário em L', 'Armário sobre vaso', 'Armário lateral', 'Armário para toalhas', 'Armário com nicho'], CABINET_ACCESSORIES),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro suspenso', 'Gaveteiro com rodízios'], CABINET_ACCESSORIES),
    group('Espelheira', ['Espelheira simples', 'Espelheira com armário', 'Espelheira com nicho'], [...STANDARD_ACCESSORIES, 'Iluminação para espelho']),
    group('Torre', ['Torre lateral', 'Torre para toalhas', 'Torre com nichos'], CABINET_ACCESSORIES),
    group('Bancada', ['Bancada para cuba', 'Bancada de apoio', 'Bancada com saia'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
    group('Nicho e prateleira', ['Nicho para banheiro', 'Nicho sobre vaso', 'Prateleira'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  Dormitório: [
    group('Guarda-roupa', ['Guarda-roupa de abrir', 'Guarda-roupa de correr', 'Guarda-roupa em L', 'Guarda-roupa de canto', 'Guarda-roupa com maleiro', 'Guarda-roupa com gaveteiro lateral', 'Guarda-roupa com TV', 'Guarda-roupa com penteadeira', 'Armário ponte sobre a cama'], WARDROBE_ACCESSORIES),
    group('Cabeceira', ['Cabeceira simples', 'Cabeceira estofada com MDF', 'Cabeceira ripada', 'Cabeceira com mesas integradas'], [...STANDARD_ACCESSORIES, 'Luminária de leitura']),
    group('Mesa de cabeceira', ['Criado-mudo suspenso', 'Criado-mudo de piso', 'Mesa lateral integrada'], [...STANDARD_ACCESSORIES, 'Carregador por indução']),
    group('Cômoda e penteadeira', ['Cômoda', 'Cômoda com gaveteiro', 'Penteadeira', 'Penteadeira suspensa', 'Toucador'], [...CABINET_ACCESSORIES, 'Espelho']),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios', 'Gaveteiro alto', 'Gaveteiro integrado à escrivaninha'], CABINET_ACCESSORIES),
    group('Estudo', ['Escrivaninha', 'Bancada de estudos', 'Escrivaninha suspensa'], [...STANDARD_ACCESSORIES, 'Organizador de cabos'], 'LINEAR_METER'),
    group('TV', ['Painel para TV', 'Painel ripado para TV', 'Rack suspenso', 'Rack de piso'], STANDARD_ACCESSORIES),
    group('Cama e armazenamento', ['Cama com gavetas', 'Cama-baú', 'Cama retrátil', 'Baú aos pés da cama'], CABINET_ACCESSORIES, 'UNIT'),
    group('Sapateira', ['Sapateira vertical', 'Sapateira baixa', 'Sapateira com espelho'], CABINET_ACCESSORIES),
    group('Nicho e prateleira', ['Nicho decorativo', 'Nicho de cabeceira', 'Prateleira'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  Suíte: [],
  Closet: [
    group('Closet', ['Closet aberto', 'Closet com portas', 'Closet linear', 'Closet em L', 'Closet em U', 'Closet de canto', 'Closet com ilha'], WARDROBE_ACCESSORIES),
    group('Módulo de closet', ['Módulo cabideiro', 'Módulo de prateleiras', 'Módulo gaveteiro', 'Módulo de canto', 'Maleiro', 'Calceiro', 'Camiseiro', 'Porta-bolsas'], WARDROBE_ACCESSORIES),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios', 'Gaveteiro central', 'Gaveteiro com tampo de vidro'], [...CABINET_ACCESSORIES, 'Tampo de vidro']),
    group('Sapateira', ['Sapateira vertical', 'Sapateira inclinada', 'Sapateira com portas', 'Sapateira giratória'], CABINET_ACCESSORIES),
    group('Ilha', ['Ilha com gavetas', 'Ilha para acessórios', 'Ilha com porta-joias'], [...CABINET_ACCESSORIES, 'Tampo de vidro'], 'UNIT'),
    group('Penteadeira', ['Penteadeira', 'Penteadeira suspensa', 'Penteadeira com espelho'], [...STANDARD_ACCESSORIES, 'Iluminação para espelho']),
    group('Apoio', ['Banco-baú', 'Armário para malas', 'Painel com espelho'], STANDARD_ACCESSORIES, 'UNIT'),
  ],
  Sala: [
    group('Painel', ['Painel liso', 'Painel para TV', 'Painel ripado', 'Painel com porta oculta', 'Painel com nichos', 'Painel divisor de ambientes'], STANDARD_ACCESSORIES),
    group('Rack', ['Rack suspenso', 'Rack de piso', 'Rack em L', 'Rack com gavetas', 'Rack com portas', 'Rack com torre lateral'], [...STANDARD_ACCESSORIES, 'Organizador de cabos']),
    group('Estante e biblioteca', ['Estante', 'Estante em L', 'Estante vazada', 'Biblioteca', 'Estante divisória', 'Móvel para livros'], CABINET_ACCESSORIES),
    group('Apoio', ['Aparador', 'Aparador com gaveteiro', 'Buffet', 'Buffet com gaveteiro', 'Banco-baú', 'Móvel lateral'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios'], CABINET_ACCESSORIES),
    group('Cristaleira e bar', ['Cristaleira', 'Bar', 'Adega', 'Porta-garrafas', 'Móvel para bebidas'], [...STANDARD_ACCESSORIES, 'Porta-taças']),
    group('Equipamentos', ['Armário para equipamentos', 'Torre para eletrônicos', 'Móvel para projetor', 'Nicho para caixas de som'], [...STANDARD_ACCESSORIES, 'Ventilação para equipamentos']),
    group('Nicho e prateleira', ['Nicho decorativo', 'Prateleira', 'Prateleira iluminada'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  'Home theater': [],
  'Sala de jantar': [
    group('Buffet e aparador', ['Buffet', 'Aparador', 'Buffet suspenso', 'Aparador com gavetas'], CABINET_ACCESSORIES, 'UNIT'),
    group('Cristaleira e louceiro', ['Cristaleira', 'Louceiro', 'Armário para louças'], [...CABINET_ACCESSORIES, 'Porta-taças']),
    group('Bar e café', ['Bar', 'Adega', 'Cantinho do café', 'Torre de café'], [...STANDARD_ACCESSORIES, 'Porta-garrafas', 'Porta-taças']),
    group('Banco alemão', ['Banco alemão reto', 'Banco alemão de canto', 'Banco alemão com baú'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Mesa', ['Mesa de jantar', 'Mesa com base em MDF', 'Mesa extensível'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Painel', ['Painel decorativo', 'Painel ripado', 'Móvel divisor'], STANDARD_ACCESSORIES),
  ],
  Escritório: [
    group('Escrivaninha', ['Escrivaninha reta', 'Escrivaninha em L', 'Escrivaninha em U', 'Escrivaninha suspensa', 'Bancada para duas pessoas'], [...STANDARD_ACCESSORIES, 'Organizador de cabos'], 'LINEAR_METER'),
    group('Estação de trabalho', ['Estação individual', 'Estação dupla', 'Estação compartilhada', 'Mesa de reunião'], [...STANDARD_ACCESSORIES, 'Calha de tomadas'], 'UNIT'),
    group('Armário', ['Armário baixo', 'Armário alto', 'Armário em L', 'Armário de canto', 'Armário aéreo', 'Armário técnico', 'Armário com gaveteiro', 'Armário para impressora'], CABINET_ACCESSORIES),
    group('Arquivo e gaveteiro', ['Gaveteiro avulso', 'Gaveteiro móvel', 'Gaveteiro fixo', 'Gaveteiro com rodízios', 'Arquivo para pastas', 'Arquivo suspenso'], [...CABINET_ACCESSORIES, 'Fechadura']),
    group('Estante', ['Estante para livros', 'Biblioteca', 'Estante vazada', 'Nicho organizador'], CABINET_ACCESSORIES),
    group('Recepção', ['Balcão de recepção', 'Balcão de atendimento', 'Painel de recepção'], [...STANDARD_ACCESSORIES, 'Passa-documentos'], 'LINEAR_METER'),
  ],
  Lavanderia: [
    group('Armário', ['Armário aéreo', 'Armário em L', 'Armário de canto', 'Armário inferior', 'Armário sobre máquina', 'Armário para produtos de limpeza', 'Armário para roupa de cama', 'Armário multiuso'], CABINET_ACCESSORIES),
    group('Gabinete', ['Gabinete de tanque', 'Gabinete em L', 'Gabinete com portas', 'Gabinete com gaveteiro', 'Gabinete com cesto de roupas'], [...CABINET_ACCESSORIES, 'Cesto de roupas']),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios'], CABINET_ACCESSORIES),
    group('Torre', ['Torre para lavadora e secadora', 'Torre de roupas', 'Torre com nichos'], CABINET_ACCESSORIES),
    group('Vassoureiro', ['Vassoureiro simples', 'Vassoureiro com prateleiras', 'Vassoureiro alto'], CABINET_ACCESSORIES),
    group('Bancada', ['Bancada de apoio', 'Bancada para dobrar roupas', 'Tábua de passar embutida'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
    group('Nicho e prateleira', ['Nicho para produtos', 'Nicho para máquina', 'Prateleira'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  'Área gourmet': [
    group('Armário', ['Armário aéreo', 'Armário aéreo em L', 'Armário inferior', 'Armário inferior em L', 'Armário de canto', 'Armário para utensílios', 'Armário para bebidas'], CABINET_ACCESSORIES),
    group('Gabinete', ['Gabinete de pia', 'Gabinete em L', 'Gabinete de canto', 'Gabinete para cooktop', 'Gabinete com gavetas', 'Gabinete com gaveteiro'], CABINET_ACCESSORIES),
    group('Balcão e bancada', ['Balcão', 'Balcão em L', 'Balcão de canto', 'Balcão com gaveteiro', 'Balcão-bar', 'Bancada para refeições', 'Península'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios'], CABINET_ACCESSORIES),
    group('Ilha', ['Ilha com armários', 'Ilha para cooktop', 'Ilha para refeições'], [...STANDARD_ACCESSORIES, 'Tomada torre'], 'LINEAR_METER'),
    group('Bebidas', ['Adega', 'Cristaleira', 'Móvel para cervejeira', 'Móvel para frigobar', 'Porta-garrafas'], [...STANDARD_ACCESSORIES, 'Porta-taças']),
    group('Churrasqueira', ['Nicho para churrasqueira', 'Armário lateral para churrasqueira', 'Módulo para utensílios de churrasco'], CABINET_ACCESSORIES),
  ],
  Churrasqueira: [],
  'Hall de entrada': [
    group('Aparador', ['Aparador', 'Aparador suspenso', 'Aparador com gavetas'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Sapateira', ['Sapateira vertical', 'Sapateira baixa', 'Sapateira com banco'], CABINET_ACCESSORIES),
    group('Armário', ['Armário de entrada', 'Armário em L', 'Armário de canto', 'Armário com gaveteiro'], CABINET_ACCESSORIES),
    group('Organização', ['Cabideiro planejado', 'Chapeleira', 'Porta-chaves', 'Banco-baú'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Painel', ['Painel com espelho', 'Painel ripado', 'Painel decorativo'], [...STANDARD_ACCESSORIES, 'Espelho']),
  ],
  Corredor: [
    group('Armário', ['Roupeiro de corredor', 'Armário para roupa de cama', 'Armário multiuso', 'Armário embutido', 'Armário com gaveteiro'], CABINET_ACCESSORIES),
    group('Apoio', ['Aparador estreito', 'Sapateira', 'Banco-baú'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Painel e prateleira', ['Painel com espelho', 'Painel ripado', 'Nicho', 'Prateleira'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
  ],
  Varanda: [
    group('Apoio', ['Banco-baú', 'Aparador', 'Buffet para varanda'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Armário', ['Armário multiuso', 'Armário em L', 'Armário de canto', 'Armário de apoio', 'Armário para utensílios'], CABINET_ACCESSORIES),
    group('Gaveteiro', ['Gaveteiro avulso', 'Gaveteiro com rodízios'], CABINET_ACCESSORIES),
    group('Bancada', ['Bancada', 'Balcão', 'Móvel para frigobar'], STANDARD_ACCESSORIES, 'LINEAR_METER'),
    group('Jardim', ['Jardineira planejada', 'Armário para jardinagem'], STANDARD_ACCESSORIES, 'UNIT'),
  ],
  Garagem: [
    group('Armário', ['Armário para ferramentas', 'Armário alto', 'Armário em L', 'Armário de canto', 'Armário aéreo', 'Armário multiuso', 'Armário para bicicletas'], [...CABINET_ACCESSORIES, 'Fechadura']),
    group('Gaveteiro', ['Gaveteiro de ferramentas', 'Gaveteiro com rodízios', 'Gaveteiro avulso'], [...CABINET_ACCESSORIES, 'Fechadura']),
    group('Bancada', ['Bancada de trabalho', 'Bancada com gavetas', 'Bancada para ferramentas'], [...STANDARD_ACCESSORIES, 'Painel perfurado'], 'LINEAR_METER'),
    group('Estante', ['Estante', 'Prateleira reforçada', 'Maleiro'], CABINET_ACCESSORIES),
  ],
  'Quarto infantil': [
    group('Guarda-roupa', ['Guarda-roupa de abrir', 'Guarda-roupa de correr', 'Guarda-roupa em L', 'Guarda-roupa de canto', 'Guarda-roupa com nichos'], WARDROBE_ACCESSORIES),
    group('Cama', ['Cama infantil', 'Cama com gavetas', 'Bicama', 'Beliche', 'Cama elevada', 'Cama casinha'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Estudo', ['Escrivaninha', 'Bancada de estudos', 'Mesa infantil'], [...STANDARD_ACCESSORIES, 'Organizador de cabos'], 'LINEAR_METER'),
    group('Organização', ['Cômoda', 'Gaveteiro avulso', 'Armário para brinquedos', 'Baú de brinquedos', 'Estante para livros'], CABINET_ACCESSORIES),
    group('Cabeceira e TV', ['Cabeceira', 'Criado-mudo', 'Painel para TV'], STANDARD_ACCESSORIES),
  ],
  'Quarto de bebê': [
    group('Berço e cama', ['Berço', 'Berço que vira cama', 'Cama auxiliar'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Guarda-roupa', ['Guarda-roupa', 'Guarda-roupa em L', 'Guarda-roupa com nichos', 'Armário ponte'], WARDROBE_ACCESSORIES),
    group('Cômoda', ['Cômoda', 'Cômoda com trocador', 'Trocador planejado'], CABINET_ACCESSORIES, 'UNIT'),
    group('Organização', ['Armário para brinquedos', 'Estante para livros', 'Baú de brinquedos', 'Nicho decorativo', 'Prateleira'], CABINET_ACCESSORIES),
  ],
  Biblioteca: [
    group('Estante', ['Estante para livros', 'Estante até o teto', 'Estante com portas', 'Estante vazada', 'Biblioteca com escada'], CABINET_ACCESSORIES),
    group('Leitura', ['Banco de leitura', 'Banco sob janela', 'Escrivaninha', 'Mesa de leitura'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Apoio', ['Armário baixo', 'Arquivo', 'Nicho', 'Prateleira'], CABINET_ACCESSORIES),
  ],
  Despensa: [
    group('Armário', ['Despenseiro', 'Armário de mantimentos', 'Armário alto', 'Armário de canto'], CABINET_ACCESSORIES),
    group('Organização', ['Prateleira', 'Gaveteiro', 'Fruteira planejada', 'Porta-temperos'], [...CABINET_ACCESSORIES, 'Cesto aramado']),
  ],
  'Adega e bar': [
    group('Adega', ['Adega vertical', 'Adega horizontal', 'Porta-garrafas', 'Móvel para adega climatizada'], [...STANDARD_ACCESSORIES, 'Porta-taças']),
    group('Bar', ['Bar com portas', 'Bar suspenso', 'Balcão-bar', 'Móvel para bebidas'], [...STANDARD_ACCESSORIES, 'Porta-taças'], 'UNIT'),
    group('Café', ['Cantinho do café', 'Torre de café', 'Bancada de café', 'Armário para café'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Exposição', ['Cristaleira', 'Prateleira iluminada', 'Nicho para bebidas'], [...STANDARD_ACCESSORIES, 'Tampo de vidro']),
  ],
  Studio: [
    group('Multifuncional', ['Cama retrátil', 'Mesa retrátil', 'Bancada retrátil', 'Sofá com armazenamento', 'Móvel divisor'], STANDARD_ACCESSORIES, 'UNIT'),
    group('Cozinha compacta', ['Minicozinha', 'Armário aéreo', 'Gabinete de pia', 'Torre de eletrodomésticos'], CABINET_ACCESSORIES),
    group('Armazenamento', ['Guarda-roupa', 'Guarda-roupa em L', 'Armário multiuso', 'Armário em L', 'Gaveteiro avulso', 'Maleiro', 'Estante'], CABINET_ACCESSORIES),
  ],
  Depósito: [
    group('Armazenamento', ['Armário alto', 'Armário multiuso', 'Estante reforçada', 'Prateleira reforçada', 'Maleiro'], [...CABINET_ACCESSORIES, 'Fechadura']),
  ],
  Recepção: [
    group('Atendimento', ['Balcão de recepção', 'Balcão de atendimento', 'Mesa de recepção'], [...STANDARD_ACCESSORIES, 'Passa-documentos'], 'LINEAR_METER'),
    group('Apoio', ['Armário baixo', 'Armário alto', 'Gaveteiro', 'Arquivo', 'Móvel para impressora'], CABINET_ACCESSORIES),
    group('Exposição', ['Painel com logotipo', 'Painel ripado', 'Estante expositora', 'Nicho iluminado'], STANDARD_ACCESSORIES),
  ],
  Consultório: [
    group('Atendimento', ['Mesa de atendimento', 'Balcão de recepção', 'Bancada clínica'], [...STANDARD_ACCESSORIES, 'Passa-fios'], 'LINEAR_METER'),
    group('Armário', ['Armário clínico', 'Armário aéreo', 'Armário para documentos', 'Armário para insumos'], [...CABINET_ACCESSORIES, 'Fechadura']),
    group('Apoio', ['Gaveteiro', 'Arquivo', 'Móvel para impressora', 'Nicho'], CABINET_ACCESSORIES),
  ],
  Loja: [
    group('Exposição', ['Expositor de parede', 'Expositor central', 'Estante expositora', 'Painel canaletado', 'Nicho iluminado'], [...STANDARD_ACCESSORIES, 'Fechadura']),
    group('Atendimento', ['Balcão de atendimento', 'Balcão caixa', 'Vitrine', 'Provador planejado'], [...STANDARD_ACCESSORIES, 'Passa-fios'], 'LINEAR_METER'),
    group('Estoque', ['Armário de estoque', 'Gaveteiro', 'Prateleira reforçada', 'Maleiro'], [...CABINET_ACCESSORIES, 'Fechadura']),
  ],
  'Espaço comercial': [
    group('Comercial', ['Balcão de atendimento', 'Balcão caixa', 'Expositor', 'Vitrine', 'Armário de estoque', 'Painel com logotipo'], [...CABINET_ACCESSORIES, 'Fechadura']),
  ],
  'Móvel especial': [
    group('Porta', ['Porta de giro', 'Porta mimetizada'], [...STANDARD_ACCESSORIES, 'Fechadura', 'Puxador cava']),
    group('Especial', ['Armário sob escada', 'Porta oculta', 'Móvel divisor', 'Painel ripado', 'Armário pet', 'Móvel para aquário', 'Oratório', 'Armário técnico'], STANDARD_ACCESSORIES, 'UNIT'),
  ],
}

QUOTE_FURNITURE_CATALOG.Suíte = QUOTE_FURNITURE_CATALOG.Dormitório
QUOTE_FURNITURE_CATALOG['Home theater'] = QUOTE_FURNITURE_CATALOG.Sala
QUOTE_FURNITURE_CATALOG.Churrasqueira = QUOTE_FURNITURE_CATALOG['Área gourmet']

export const QUOTE_ENVIRONMENT_OPTIONS = Object.keys(QUOTE_FURNITURE_CATALOG)
export const QUOTE_CALCULATION_MODE_LABELS: Record<QuoteCalculationMode, string> = {
  AREA_M2: 'Por m² (automático)',
  LINEAR_METER: 'Por metro linear',
  UNIT: 'Por unidade',
}

const PERSONALIZED_GROUP = group('Personalizado', ['Móvel personalizado'], STANDARD_ACCESSORIES)

export function getQuoteFurnitureGroups(environment: string) {
  return [...(QUOTE_FURNITURE_CATALOG[environment] || []), PERSONALIZED_GROUP]
}

export function getQuoteFurnitureGroup(environment: string, furnitureType: string) {
  return getQuoteFurnitureGroups(environment).find((item) => item.type === furnitureType) || PERSONALIZED_GROUP
}

export function resolveQuoteFurnitureSelection(environment: string, description: string) {
  for (const furnitureGroup of getQuoteFurnitureGroups(environment)) {
    if (furnitureGroup.models.includes(description)) {
      return { furnitureType: furnitureGroup.type, furnitureModel: description, customFurniture: '' }
    }
  }

  return {
    furnitureType: PERSONALIZED_GROUP.type,
    furnitureModel: PERSONALIZED_GROUP.models[0],
    customFurniture: description,
  }
}

export function getQuoteFurnitureAccessories(environment: string, furnitureType: string) {
  return [...new Set(getQuoteFurnitureGroup(environment, furnitureType).accessories || STANDARD_ACCESSORIES)]
}

export function getQuoteFurnitureDescription(furnitureType: string, furnitureModel: string, customFurniture: string) {
  return furnitureType === PERSONALIZED_GROUP.type ? customFurniture.trim() : furnitureModel.trim()
}
