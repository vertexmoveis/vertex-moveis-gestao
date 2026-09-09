# CRM Vertex e Konekto — primeira entrega

Data: 9 de setembro de 2026. Implementação e validação locais; ainda não publicada.

A Konekto continua responsável por entrada de leads, atendimento, reuniões e negociação. A Vertex recebe o briefing, elabora a proposta, registra a venda e acompanha sua execução. Esta entrega permite testar esse processo com encaminhamento manual.

## Fluxo disponível

1. Em **Orçamentos → Solicitações**, registrar cliente, resumo da reunião, ambientes, responsável comercial, orçamentista e data de retorno. A data desejada de entrega é uma expectativa a confirmar. Os links de oportunidade e referências acompanham a solicitação.
2. O responsável confirma recebimento, informa pendências e próxima ação, e abre o orçamento com os dados da solicitação. O vínculo se mantém no grupo de alternativas. Uma referência externa repetida não cria outra solicitação; uma solicitação já vinculada não cria outro grupo.
3. A proposta segue o aceite existente pelo link do cliente. Em **Fechamentos**, propostas aceitas aguardam o registro da venda. Fechar a venda cria um projeto em preparação e parcelas a receber. Nenhum recebimento é fabricado pelo fechamento.
4. O Financeiro registra o recebimento efetivo. O fluxo inicia o prazo previsto a partir da entrada confirmada; para uma condição aprovada sem entrada, usa a data da venda. Reabrir o recebimento não altera o prazo já registrado. Conferir esse marco com a condição contratual no piloto.
5. No projeto, registrar separadamente o aceite técnico: cliente, data, evidência e conjunto de arquivos aprovado. Alterar os arquivos técnicos exige novo aceite. O aceite comercial do orçamento não substitui essa aprovação nos projetos novos.
6. A liberação considera condição financeira, contrato aplicável, arquivos, aprovação técnica e impedimentos. O avanço por etapas confere também as fases intermediárias quando alguém tenta saltá-las. As exceções administrativas existentes continuam sendo registradas.
7. Produção, instalação, financeiro, compras e pós-venda continuam nos módulos existentes. A tela do projeto mostra tarefas e próxima ação.

## Organização e preservação

- Menu com Visão geral, Orçamentos, Fechamentos e Agenda operacional; atalhos operacionais preservados.
- Indicadores comerciais anteriores disponíveis em `/dashboard/sales/history`.
- Lembretes comerciais automáticos de propostas ligadas a solicitações ficam fora da rotina antiga de WhatsApp da Vertex. O acompanhamento comercial desses casos cabe à Konekto. Propostas legadas conservam a rotina anterior.
- Solicitações respeitam acesso do criador e do responsável, além do administrador. Registrar recebimentos continua sujeito à permissão financeira.
- Solicitações incluídas na ordem de backup/restauração e na exportação de dados do cliente.
- Projetos anteriores recebem `workflowVersion = 1`; novos projetos usam a versão 2. A migração não reescreve recebimentos, datas ou aceites existentes.

## Validação realizada

- Compilação otimizada do Next.js concluída, incluindo checagem de tipos.
- Checagem independente de TypeScript e ESLint sem erros.
- 184 testes automatizados passaram, incluindo nove testes específicos do novo fluxo.
- Migração aplicada sobre uma base sintética anterior: preservação da versão antiga e padrão novo conferidos.
- Teste integrado com dados fictícios: autenticação, acesso por responsável, duplicidade, atualização antiga, orçamento, aceite público, fechamento único, entrada pendente, confirmação/reabertura financeira, aprovação técnica, revisão de arquivos e bloqueio de salto de fases.
- Navegador: criação de solicitação pelo formulário; Solicitações, Fechamentos e Projeto em desktop e largura de celular; sem erros JavaScript ou rolagem horizontal. Edição do projeto preservou o instante do recebimento e o prazo registrado.

Os testes integrados usaram PostgreSQL local em memória via PGlite, com integrações externas desativadas. Não validam concorrência do banco de produção, entrega de mensagens, armazenamento remoto ou credenciais da Konekto. Evidências e scripts locais estão em `../../analysis/workflow-test-runtime/`, relativos a este documento.

## Ativação e continuidade

Antes de executar esta versão em um ambiente compartilhado, aplicar a migração `20260909160000_quote_requests_and_preparation` e gerar o cliente Prisma pelo fluxo de implantação do projeto. A migração está preparada no código, mas não foi executada na base real. A publicação também não foi realizada.

O plano completo está em [PLANO_CRM_VERTEX_KONEKTO.md](PLANO_CRM_VERTEX_KONEKTO.md). As etapas seguintes são:

- Fazer o piloto com casos reais e confirmar responsáveis, evidência do aceite e marco contratual dos prazos.
- Manter o encaminhamento manual entre Konekto e Vertex, conforme decisão do usuário. Integração automática não faz parte do escopo solicitado.
- Definir e implementar alçadas de desconto/margem, relatórios adicionais e regras avançadas de capacidade ou liberação parcial por ambiente conforme a necessidade observada.

Limitações da primeira versão: a aprovação técnica é registrada pela equipe com evidência; não é uma nova assinatura eletrônica do cliente. O vínculo externo depende do identificador informado. As regras legadas foram preservadas, e sua revisão exige conferência individual no piloto.

## Preparação para publicação

A primeira tentativa de publicação foi interrompida pela auditoria de dependências, antes de acessar produção. A versão de publicação atualiza Next.js e eslint-config-next para 16.3.4, sharp para 0.35.4 e as dependências transitivas sinalizadas. A auditoria completa passou sem vulnerabilidades. Os 181 testes da versão isolada passaram; os três testes adicionais da pasta original pertencem à alteração separada do visualizador de arquivos e não fazem parte desta publicação.
