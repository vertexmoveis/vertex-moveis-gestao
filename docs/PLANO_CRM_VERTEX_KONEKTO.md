# Plano de adequação da Vertex: orçamento, venda e execução

Data: 09/09/2026. Revisão 3. Status: primeira entrega implementada e validada localmente; publicação em andamento. A divisão entre Konekto e Vertex foi confirmada pelo usuário; as regras operacionais abaixo são recomendações para implementação.

## 1. Direção confirmada

O usuário confirmou a divisão: **Konekto no atendimento; Vertex nos orçamentos e projetos.**

A Konekto acompanha a entrada do lead, qualificação, conversas, reuniões, negociação e retorno comercial. A Vertex calcula e registra o que será vendido, formaliza o fechamento e acompanha o cumprimento da venda até instalação e pós-venda.

A Vertex deve receber uma solicitação quando já houver informações suficientes para preparar um orçamento. Não é necessário aguardar a venda para começar a trabalhar nela, nem importar todos os leads.

Este plano se baseia na leitura estática do código em `current/`, especialmente menu, modelos de dados, vendas, conversão de orçamento, regras de projeto e lembretes. Recursos identificados no código não foram validados em produção. A imagem serve como referência de contexto; não comprova as possibilidades de integração da conta Konekto.

## 2. Responsabilidade de cada sistema

| Processo ou informação | Sistema responsável | Como o outro participa |
| --- | --- | --- |
| Captação, origem e qualificação do lead | Konekto | Vertex recebe a origem como referência |
| Conversas, reuniões e retornos comerciais | Konekto | Vertex recebe briefing e link da oportunidade |
| Solicitação de orçamento | Vertex após encaminhamento | Konekto registra encaminhamento e acompanha o retorno |
| Itens, medidas, materiais, preços e versões | Vertex | Konekto acessa a proposta gerada |
| Negociação com o cliente | Konekto | Alteração de valores ou escopo é feita na Vertex e gera nova versão |
| Aceite da proposta, contrato e registro do pedido | Vertex | Konekto recebe o resultado confirmado |
| Recebimentos e situação financeira | Vertex | Konekto recebe apenas o resumo necessário |
| Medição técnica, produção, instalação e garantia | Vertex | Konekto pode consultar marcos resumidos |
| Campanhas e reativação comercial | Konekto | Vertex fornece contexto quando necessário |

Decisão proposta: a marcação “ganho” da Konekto pode solicitar a conferência do fechamento, mas não confirma recebimento nem libera produção. O registro formal da venda fica na Vertex e retorna à oportunidade da Konekto. Essa regra evita dois registros concorrentes de valor e fechamento.

## 3. Fluxo esperado

1. **Konekto — lead e reunião:** comercial entende ambientes, necessidade, local, prazo desejado e faixa de investimento, quando informada.
2. **Vertex — solicitação recebida:** responsável confere briefing, anexos e informações faltantes.
3. **Vertex — orçamento:** elabora ambientes e móveis, custos, margem, pagamento, prazo e versões alternativas.
4. **Konekto — apresentação e negociação:** comercial compartilha o link gerado pela Vertex e registra o retorno do cliente.
5. **Vertex — revisão ou aceite:** alterações geram versão rastreável; aceite identifica exatamente a opção escolhida.
6. **Vertex — fechamento:** registrar responsável e data da confirmação comercial, vinculados à versão aceita, escopo e condições de pagamento. Criar um único projeto em preparação, que represente a execução dessa venda, sem exigir um segundo cadastro manual de pedido. Contrato e entrada continuam com situações próprias.
7. **Vertex — preparação:** acompanhar contrato, entrada, medição e aprovação técnica como pendências independentes.
8. **Vertex — produção:** liberar somente quando os requisitos aplicáveis estiverem atendidos; acompanhar ambientes, materiais, bloqueios e prazos.
9. **Vertex — instalação e entrega:** agendar equipe, registrar execução, conferir pendências e obter confirmação de entrega.
10. **Vertex — pós-venda:** acompanhar assistência e garantia. Eventual nova compra volta a ser uma nova oportunidade comercial na Konekto.

Uma pessoa pode ter várias oportunidades e vários projetos. O vínculo entre sistemas precisa identificar a oportunidade e a solicitação, além do cliente.

## 4. O que manter e aproveitar

| Recurso encontrado na Vertex | Direção |
| --- | --- |
| Clientes, identidade normalizada e histórico | Manter como cadastro vinculado a solicitações, vendas e obras |
| Orçamentos por ambiente, itens, preços, custos, revisões e alternativas | Manter como núcleo do sistema |
| Propostas e aprovação pública versionada | Manter; compartilhar o link pelo atendimento da Konekto |
| Conversão de orçamento em projeto | Aproveitar e adaptar a separação entre venda e recebimento |
| Contratos, pagamentos e histórico | Manter vinculados à mesma venda |
| Projetos, fases, ambientes e arquivos | Manter como centro de acompanhamento |
| Produção, bloqueios, capacidade e prazos | Manter como visão operacional dos projetos |
| Instalação, equipes e calendário | Manter para visitas técnicas, produção e entregas |
| Compras, materiais, custos reais e financeiro | Manter, com acesso conforme a função |
| Portal do cliente, alterações de escopo e garantia | Aproveitar a base existente e validar o fluxo completo |

Não há motivo para reconstruir esses módulos. O trabalho principal é conectá-los em uma jornada coerente.

## 5. O que falta ou precisa ser ajustado

### Prioridade 1 — Entrada de orçamento organizada

Criar uma fila **“Solicitações de orçamento”** dentro de Orçamentos, antes do rascunho da proposta.

Dados mínimos: cliente e contato, referência da oportunidade Konekto, responsável comercial, responsável pelo orçamento, ambientes pretendidos, resumo da reunião, prazo desejado e anexos disponíveis. Medidas podem estar pendentes; não transformar uma estimativa em medida técnica confirmada.

Estados: recebida, falta informação, em elaboração e proposta pronta. Toda pendência deve indicar responsável e próxima ação. A data de retorno do orçamento é diferente do prazo da fabricação.

Começar com encaminhamento manual padronizado e link da oportunidade. Automatizar após validar o fluxo real e as capacidades da conta Konekto.

### Prioridade 2 — Fechamento independente do recebimento

Hoje, `app/api/quotes/[id]/convert/route.ts` exige proposta aprovada, comprovante de aceite, condições de pagamento e data de confirmação do pagamento. A conversão também pode marcar a entrada como recebida e calcula datas a partir dessa confirmação.

Proposta de ajuste: permitir um projeto em preparação após o fechamento comercial formal, exibindo claramente **“entrada pendente”** e **“contrato pendente”**, quando aplicável. Receber pagamento é uma ação separada, com valor, data e responsável.

Preservar a exigência de aceite rastreável. Se existir venda concluída por outro canal, prever um fluxo explícito de registro de evidência, sem criar um aceite fictício.

Separar os estados:

- Proposta: em elaboração, enviada, em revisão, aceita, recusada ou expirada.
- Venda: em formalização, fechada ou cancelada.
- Financeiro: entrada pendente/parcial/recebida e parcelas em aberto/recebidas.
- Projeto: preparação, produção, instalação, concluído; bloqueio como condição acompanhada de motivo.

“Aceitou a proposta”, “fechou a venda”, “pagou” e “pode produzir” devem ser eventos diferentes. O sistema já tem bases de contrato e liberação financeira; ajustar e consolidar essas regras, sem criar verificações paralelas.

### Prioridade 3 — Aprovação técnica e prazos claros

O código de fases utiliza `approvalDate` para a tarefa “Aprovação do cliente registrada”, enquanto a conversão preenche esse campo com o aceite comercial. Isso indica uma possível confusão que deve ser validada e resolvida: aceitar o orçamento não comprova aprovação do desenho técnico final.

Vincular a aprovação técnica à versão do projeto/desenho e registrar autor e data. Anexar um arquivo não equivale a aprová-lo.

Exibir separadamente prazo desejado, prazo contratado, previsão operacional e motivo de reprogramação. Definir no fechamento o marco acordado de início da contagem e registrá-lo; a regra atual usa confirmação de pagamento. Não alterar datas antigas silenciosamente ao implantar a nova regra.

### Prioridade 4 — Projeto como tela central

Organizar o projeto em resumo, preparação técnica, produção, instalação, financeiro, documentos e histórico. Destacar sempre etapa, responsável, próxima ação, prazo e bloqueio.

Produção e Instalação continuam disponíveis como visões por equipe dos mesmos projetos. Não devem criar cadastros ou status independentes concorrentes.

O sistema já possui estruturas de alteração de escopo. Validar que uma alteração aprovada repercuta uma única vez em valor, saldo, documentos e prazo, preservando o orçamento vendido original. Pendências de instalação e garantia precisam de responsável e data, sem exigir a criação de uma nova venda.

### Prioridade 5 — Passagem manual entre Konekto e Vertex

Decisão confirmada pelo usuário: não é necessária conexão automática com a Konekto. A equipe registra na Vertex o briefing, cliente, ambientes, responsável e prazo de retorno. O link da oportunidade e seu identificador são referências opcionais.

O comercial acompanha o andamento na Vertex e atualiza a Konekto manualmente quando necessário. Integração por API, sincronização, webhooks comerciais, fila de eventos e reenvio ficam fora do escopo.

## 6. O que tirar, juntar ou deixar para depois

| Mudança | Recomendação |
| --- | --- |
| Funil completo de leads e reuniões na Vertex | Não ampliar; responsabilidade da Konekto |
| Próxima ligação e retorno comercial no cadastro Vertex | Retirar da rotina principal após a passagem para Konekto, preservando histórico |
| Tela Vendas com funil comercial e cobranças | Transformar em “Fechamentos” ou aba de Orçamentos: aceites, contratos/entrada pendentes e pedidos gerados |
| Cobrança automática de resposta ao orçamento pelos dois sistemas | Definir Konekto como responsável pelo retorno comercial e desativar a duplicidade na Vertex após validação |
| Mensagens de contrato, cobrança financeira, instalação e garantia | Vertex determina o evento; escolher um canal de envio por tipo, sem dois disparos |
| Contratos como jornada separada do projeto | Integrar a navegação ao fechamento/projeto, mantendo visão geral para gestão e exceções existentes |
| Calendário comercial na Vertex | Não adicionar; reservar a agenda para operação |
| Marketing, sites, campanhas e central de conversas própria | Fora deste plano da Vertex |
| Plano de corte, etiquetas, apontamento detalhado e estoque avançado | Manter disponíveis como recursos avançados, sem bloquear orçamento/fechamento com preenchimentos desnecessários |
| Exclusão de módulos e dados históricos | Não executar como primeira medida; simplificar navegação e desligar rotinas redundantes antes de considerar remoção de código |

Não é necessário copiar o menu da imagem. As duas ferramentas têm responsabilidades diferentes na operação.

## 7. Navegação e painel propostos

Menu principal: **Visão geral; Orçamentos; Projetos; Agenda operacional; Clientes; Financeiro; Compras; Configurações.**

Orçamentos reúne solicitações, propostas e fechamentos. Projetos oferece visões de todos os projetos, produção, instalação e pós-venda. Contratos continuam acessíveis no contexto e por um filtro geral. Equipes podem manter atalhos diretos para Produção e Instalação.

Painel inicial voltado a ações: orçamentos a elaborar, propostas aceitas aguardando formalização, projetos aguardando entrada/contrato/aprovação técnica, produção bloqueada, entregas próximas e pendências de instalação. Valores financeiros aparecem conforme permissão.

Indicadores: tempo de elaboração do orçamento, propostas aceitas, vendas registradas, recebido/a receber, projetos entregues no prazo e custo previsto versus real. Quantidade de leads, reuniões e conversão da captação pertencem ao painel comercial da Konekto. Contar alternativas/revisões de uma proposta como uma negociação, com períodos e critérios explícitos.

## 8. Ordem de execução e critérios de conclusão

| Etapa | Entrega | Critério para concluir |
| --- | --- | --- |
| 1. Organizar a passagem | Modelo de briefing, responsáveis, referência Konekto, fila de solicitações e rotina de encaminhamento manual | Uma solicitação consegue chegar à proposta sem procurar dados em várias conversas; a responsabilidade pelo encaminhamento manual fica clara |
| 2. Consolidar fechamento | Aceite, venda, recebimento e criação de projeto separados | Venda fechada com entrada pendente aparece na preparação sem fabricar um recebimento |
| 3. Ajustar execução | Aprovação técnica versionada, datas explícitas e próxima ação | Equipe identifica o que falta e só libera produção com requisitos atendidos |
| 4. Simplificar telas | Novo menu, Fechamentos e painel operacional | Comercial e operação encontram suas pendências sem alimentar dois funis |
| 5. Fazer piloto com passagem manual | Casos reais acompanhados, medição de retrabalho e conferência de dados existentes | Equipe completa o fluxo e identifica responsáveis, pendências e prazos na rotina manual |
| 6. Consolidar a rotina manual | Responsáveis, instruções e acompanhamento de pendências | Equipe consegue encaminhar e acompanhar cada caso sem integração automática |

Não estimar prazo fechado de desenvolvimento sem validar a integração e o volume de ajustes da base existente.

Casos obrigatórios de validação: orçamento não vendido; duas alternativas com uma escolhida; mesmo cliente com duas obras; venda com entrada pendente; contrato em aberto; desenho técnico revisado; alteração de escopo; instalação parcial; cancelamento após recebimento; evento repetido ou fora de ordem; venda antiga criada por contrato avulso.

Na transição, preservar propostas, aceites, contratos, recebimentos e projetos existentes. Manter casos sem vínculo externo identificados como legados e conferir divergências antes de associar oportunidades. Não recalcular retroativamente datas ou valores por causa da reorganização.

## 9. Pontos do código para orientar a implementação

- `current/components/layout/sidebar.tsx`: menu atual e grupos de acesso.
- `current/app/dashboard/sales/page.tsx`: indicadores por orçamento, retornos comerciais e vendas de contratos avulsos.
- `current/lib/client-relationship.ts`: classificação comercial, identidade e possíveis duplicados.
- `current/prisma/schema.prisma`: clientes, grupos e versões de orçamento, projetos, contratos e alterações de escopo.
- `current/app/api/quotes/[id]/convert/route.ts`: conversão, recebimento inicial e datas operacionais.
- `current/lib/project-workflow.ts` e `current/lib/project-phases.ts`: requisitos de preparação e fases.
- `current/lib/whatsapp-reminders.ts`: lembretes comerciais e operacionais que precisam de responsabilidade definida.
- `current/lib/quote-group-list.ts`: agrupamento de alternativas para preservar a unidade da negociação.

## 10. Melhorias da revisão 2: regras para a rotina funcionar

### 10.1. Encaminhar também exige alguém receber

Encaminhamento comercial e recebimento pelo orçamentista são eventos distintos. Toda solicitação deve ter responsável na Vertex, prazo combinado de retorno e confirmação de recebimento. Se faltarem informações, registrar quais são e devolver uma ação ao comercial da Konekto. Conservar a solicitação visível até a resposta, com tempo total e tempo aguardando informação separados.

Não permitir que uma solicitação desapareça por ter sido “enviada ao outro sistema”. Disponibilizar filtros: sem responsável, aguardando informação, prazo próximo e atrasadas. No início, a confirmação e o retorno podem ser manuais.

### 10.2. Dar autonomia ao orçamento com limites comerciais claros

Antes de enviar, apresentar escopo incluído e excluído, materiais, instalação/frete, condições de pagamento, validade e natureza das medidas: estimadas ou conferidas. Custos ainda não conferidos devem aparecer como estimativas internamente.

Definir alçadas configuráveis de desconto e margem mínima. Dentro da alçada, o responsável conclui a proposta sem aprovação adicional; fora dela, solicita autorização e registra o motivo. Os valores dessas alçadas devem ser definidos pela Vertex, sem limites inventados pelo sistema.

Versões alternativas da mesma compra permanecem agrupadas. Se o cliente escolher apenas alguns ambientes, gerar a versão final com exatamente o escopo escolhido e obter seu aceite antes do fechamento. Não marcar o orçamento inteiro como vendido quando apenas uma parte foi contratada. Uma ampliação posterior usa alteração de escopo ou nova venda, conforme a relação com a obra original.

### 10.3. Definir o que cada avanço significa

| Ação | Evidência ou condição | Resultado esperado |
| --- | --- | --- |
| Registrar venda | Versão aceita, valor, escopo, condições e confirmação comercial com autor/data | Projeto em preparação; nenhuma baixa financeira automática |
| Confirmar entrada | Recebimento registrado com valor, data e responsável | Atualiza saldo e situação financeira; não aprova desenho técnico |
| Liberar produção | Condição financeira aplicável, contrato exigível e versão técnica aprovada para o escopo liberado | Registra autor/data da liberação e preserva a versão usada |
| Agendar instalação | Escopo pronto ou previsão identificada como provisória, equipe e condições do local conferidas | Compromisso confirmado somente com prontidão validada |
| Concluir entrega | Ambientes contratados conferidos e pendências de instalação resolvidas | Conclusão operacional, independentemente de parcelas futuras |

Registrar venda sem entrada, quando permitido pelas condições comerciais, não equivale a dispensar a entrada para produção. Quando a condição contratada não exigir entrada, a liberação segue essa condição registrada; não criar um pagamento fictício para satisfazer o sistema.

Separar conclusão operacional de quitação financeira: um projeto entregue pode ter parcelas futuras. Uma instalação com pendências fica “instalada com pendências”; assistência surgida após uma entrega concluída vira chamado de garantia vinculado ao projeto.

### 10.4. Tratar imprevistos dentro do projeto

- **Local sem condições para montagem:** checklist curto de acesso, medidas, interferências e disponibilidade do cliente, com observação/foto quando necessária. Nova previsão não apaga a data contratada.
- **Obra pausada ou material em falta:** motivo, responsável, próxima verificação e impacto previsto no prazo. A pausa não altera automaticamente o compromisso comercial.
- **Mudança após início da fabricação:** registrar itens afetados, custo adicional ou redução, material já comprometido e impacto no prazo. Exigir aceite da mudança aplicável antes de executar; manter o restante não afetado identificável.
- **Cancelamento:** preservar valores recebidos, registrar interrupção e tratar eventuais devoluções e compromissos de compra em ações próprias. Não apagar histórico ou marcar parcelas como pagas para encerrar o projeto.

Na primeira versão, acompanhar etapas por ambiente e conclusão parcial da instalação. Liberação independente de fabricação por ambiente pode ficar para uma etapa posterior, com regras próprias, se a rotina da marcenaria justificar essa complexidade.

### 10.5. Fazer cada pessoa enxergar sua fila de trabalho

| Função | Visão prioritária |
| --- | --- |
| Comercial/orçamentista | Solicitações, informações faltantes, propostas e pendências do fechamento |
| Responsável técnico | Medições, desenhos, versões e aprovações técnicas |
| Produção | Projetos liberados, materiais, arquivos vigentes e bloqueios |
| Instalação | Agenda no celular, endereço, ambientes, checklist e pendências |
| Gestão/financeiro | Recebimentos, custos, exceções de desconto, atrasos e resultado |

Usar os mesmos registros em todas as visões. Rever as permissões existentes por ação, incluindo quem pode alterar preços, ver custos, registrar recebimentos e liberar produção. Ocultar um botão não substitui conferir a permissão no servidor. No menu, conservar atalhos de uso frequente para evitar que a simplificação aumente o número de cliques.

### 10.6. Limitar a primeira entrega e antecipar o piloto

**Primeira entrega:** solicitação com responsável/prazo, orçamento e versão escolhida, fechamento sem recebimento fictício, aprovação técnica independente, projeto com próxima ação e checklist de entrega. Aproveitar os módulos existentes de financeiro, compras, produção e documentos.

**Depois do piloto:** relatórios adicionais, regras avançadas de capacidade e liberação parcial por ambiente conforme necessidade. A passagem entre sistemas permanece manual; integração automática está fora do escopo.

Escolher casos representativos, incluindo uma venda simples, uma com revisão e outra com vários ambientes. Durante o piloto, avaliar tempo entre solicitação e proposta, solicitações sem responsável, necessidade de redigitação, vendas aguardando preparação e pendências de entrega. O critério de sucesso é a equipe conseguir seguir cada caso e identificar o próximo passo sem manter controles paralelos.

## 11. Decisões de operação a fechar antes de implementar cada etapa

As recomendações acima permitem detalhar a implementação. Antes de ativar as regras correspondentes, registrar com a Vertex: alçadas de desconto/margem; evidência exigida para fechamento; condição financeira para liberar fabricação; marco contratual do prazo; quem pode autorizar exceções; responsável e canal de cada mensagem; necessidade real de produção parcial por ambiente. Essas decisões não impedem começar pelo briefing, mapeamento de dados e desenho das telas.

Resultado esperado: a Konekto mantém o relacionamento comercial; a Vertex transforma o escopo negociado em orçamento confiável, venda rastreável e projeto entregue, com cada informação registrada no lugar responsável por ela.

## 12. Situação da primeira entrega — 9 de setembro de 2026

Implementados localmente: solicitações com responsável/prazo e vínculos, abertura do orçamento pela solicitação, fechamento sem recebimento automático, aprovação técnica separada e vinculada aos arquivos, bloqueios de avanço, tela de Fechamentos e ajustes de navegação. Os módulos operacionais existentes foram reaproveitados. A migração preserva a versão do fluxo de projetos antigos.

Validação: compilação, TypeScript e ESLint concluídos; 184 testes passaram; fluxo integrado e telas conferidos com dados fictícios locais. Detalhes, limitações e instruções de ativação estão em `../current/docs/CRM_VERTEX_KONEKTO_ENTREGA.md`.

Ainda pendentes: publicação e migração em ambiente real, piloto com a equipe, alçadas comerciais e demais evoluções após o piloto. O encaminhamento desta primeira entrega é manual. Este registro não declara as seis etapas do plano integralmente concluídas.
