type DeliverySchedulingMessageInput = {
  clientName: string
  projectName: string
  suggestedDate?: string | null
}

export function buildDeliverySchedulingWhatsAppMessage({
  clientName,
  projectName,
  suggestedDate,
}: DeliverySchedulingMessageInput) {
  return [
    `Olá, ${clientName}! Tudo bem?`,
    '',
    `Aqui é da Vertex Móveis. Gostaríamos de agendar a entrega e a instalação dos móveis do projeto "${projectName}" na sua residência.`,
    suggestedDate
      ? `Temos como sugestão o dia ${suggestedDate}. Essa data funciona para você?`
      : 'Qual é o melhor dia para realizarmos a entrega?',
    'Você prefere o período da manhã ou da tarde?',
    'Pode confirmar também se o endereço de entrega continua o mesmo do cadastro, por favor?',
  ].join('\n')
}
