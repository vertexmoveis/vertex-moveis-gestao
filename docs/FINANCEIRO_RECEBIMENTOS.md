# Financeiro: recebimentos e vendas

O Financeiro pode ser usado por Administrador e Gerente. A tela separa o dinheiro que entrou na empresa das vendas fechadas e propostas em negociação.

## Como registrar o dinheiro recebido

| Situação | Ação na tela | Resultado |
| --- | --- | --- |
| Cartão com repasse integral | **Registrar repasse integral**; conferir data, valor bruto e taxa | Um recebimento quita o saldo inteiro do projeto. As parcelas do cliente ficam como condição comercial. |
| Entrada de um projeto no cartão paga por outro meio | **Registrar entrada por outro meio** | A entrada reduz o saldo que será recebido no repasse do cartão. |
| Dinheiro, Pix ou transferência | **Registrar recebimento** com o valor efetivo | Aceita recebimento integral ou parcial e atualiza o saldo restante. |
| Boleto pago pelo cliente | **Receber / antecipar**, escolhendo recebimento direto | Registra a entrada efetiva na empresa, com a data e eventual taxa. |
| Análise do jurídico | **Análise do jurídico**; registrar decisão, limite e observação | Atualiza o limite do cadastro do cliente, compartilhado entre seus projetos. A análise não aumenta o caixa. |
| Antecipação de boleto já recebida | **Receber / antecipar**, escolhendo antecipação | Exige crédito aprovado, respeita o limite disponível do cliente e registra o valor que a empresa recebeu. |

Exemplo de cartão: venda de **R$ 50.000**, taxa de **R$ 2.000**. O projeto registra R$ 50.000 de recebimento bruto, R$ 48.000 líquidos e saldo zero. O pagamento das parcelas pelo titular do cartão não gera novas entradas para a empresa.

Exemplo de pagamento parcial: em uma venda de **R$ 50.000**, receber **R$ 15.000** deixa **R$ 35.000** a acertar. Um segundo recebimento reduz somente o saldo restante. Não é necessário marcar cada parcela como paga.

Exemplo de boleto: limite aprovado de **R$ 30.000** não representa dinheiro recebido. Antecipar **R$ 20.000**, com taxa de R$ 500, registra R$ 19.500 líquidos e deixa R$ 10.000 de limite disponível para os projetos daquele cadastro de cliente. Um boleto já antecipado não deve gerar outra entrada para a Vertex quando o cliente pagar o título ao jurídico ou financiador.

Criar um projeto ou fechar uma venda não cria recebimentos automaticamente, inclusive no cartão. O repasse é registrado uma vez, quando ocorrer, para manter valor, taxa e data corretos. A antecipação integral segue a operação contratada pela Vertex com a credenciadora; a Stone explica como a antecipação adianta as parcelas e desconta suas taxas. [Stone — antecipação e seus benefícios](https://ajuda.stone.com.br/antecipacao-e-seus-beneficios).

## Conferir o mês e exportar

- **Entrou no mês**: soma dos recebimentos registrados naquele mês, descontadas as taxas. **Caixa** mostra bruto, taxas e líquido. Usa o horário de São Paulo.
- **Saldo a acertar**: saldo atual dos projetos, inclusive vendas de outros meses. Mudar o mês não reconstrói automaticamente o saldo bancário de uma data passada.
- **Vendido no mês**: vendas pela data de aprovação do projeto; sem ela, usa início e depois criação. Um orçamento convertido em projeto conta uma vez.
- **Em negociação**: propostas enviadas ainda abertas, inclusive as iniciadas antes do mês escolhido. Não inclui rascunhos. As alternativas de acabamento de uma mesma proposta contam uma oportunidade, sem somar seus valores.
- **Perdido no mês**: negociações atualmente encerradas sem venda, com todas as opções perdidas, pelo mês da última perda registrada. Não representa inadimplência, devolução ou saída de dinheiro.
- **Vendido + potencial**: vendido no mês mais propostas em negociação. É uma medida comercial e não dinheiro disponível.

Use **CSV de recebimentos** para exportar as entradas reais e saldos; **CSV de vendas** exporta os resultados comerciais e seus critérios. A busca por cliente ou projeto filtra as listas e os totais da tela. O relatório comercial mostra a data da posição; períodos históricos podem apresentar negociação estimada quando o histórico disponível não permite reconstrução completa.

## Correções e limites do controle

- **Estornar registro** preserva o recebimento original, exige motivo e recompõe o saldo. Um estorno de lançamento corrige o controle; não executa transferência ou devolução bancária. Recebimentos estornados deixam de compor os totais do mês original.
- A análise jurídica acontece fora do site. O sistema registra a decisão manualmente; não consulta cadastro de crédito, não determina o limite e não efetiva uma antecipação no banco. O boleto é um instrumento de pagamento; seu registro ou emissão não representa recebimento. A análise e a antecipação de recebíveis são operações distintas do cadastro da venda. [Serasa Experian — antecipação de recebíveis](https://www.serasaexperian.com.br/conteudos/antecipacao-de-recebiveis-aprenda-a-escolher-o-parceiro-certo/).
- O limite disponível corresponde ao aprovado menos as antecipações ativas do cadastro de cliente, em todos os seus projetos. O controle não acompanha automaticamente os pagamentos posteriores ao jurídico para renovar esse limite. Cadastros diferentes não são unidos automaticamente pelo CPF/CNPJ.
- Projetos arquivados mantêm seus recebimentos no mês original e no CSV; o saldo arquivado não entra nas cobranças em aberto.
- Registros anteriores mantêm os valores e datas existentes. Taxas não informadas não foram estimadas; o líquido histórico desses registros depende das informações disponíveis. Projetos antigos no cartão não são marcados retroativamente como recebidos.
- Mudanças de status de orçamento não possuem histórico completo. Reabrir uma negociação perdida pode remover sua data de perda anterior; por isso os resultados históricos refletem os registros disponíveis.
- Recibo integral só fica disponível para lançamento recebido por inteiro. Recebimentos parciais devem ser consultados no histórico do Financeiro. O cronograma não pode ser refeito depois de registrar recebimentos, para preservar os vínculos e valores do histórico.

Referências consultadas em 19/10/2026. Os links explicam os instrumentos financeiros; as regras de tela acima descrevem a operação implementada para a Vertex.
