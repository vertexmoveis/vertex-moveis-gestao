<p align="center">
  <img src="./public/vertex-logo.png" alt="Vertex Móveis" width="260">
</p>

# Vertex Móveis - CRM e Gestão

Sistema interno da Vertex Móveis para acompanhar todo o ciclo de uma venda de móveis planejados: cliente, orçamento, aprovação, projeto, produção, instalação, pagamentos, compras e pós-venda.

- Produção: [vertex-moveis-gestao.vercel.app](https://vertex-moveis-gestao.vercel.app)
- Repositório: [github.com/vertexmoveis/vertex-moveis-gestao](https://github.com/vertexmoveis/vertex-moveis-gestao)
- Idioma: Português do Brasil
- Uso: interno e privado

## Visão geral

O CRM centraliza informações que antes poderiam ficar espalhadas em conversas, planilhas e documentos. O fluxo principal é:

1. Cadastrar o cliente.
2. Criar um orçamento com ambientes, móveis, medidas e acabamentos.
3. Calcular preço, custo, desconto, entrada e parcelas.
4. Gerar a proposta comercial ou o orçamento simples.
5. Enviar um link para o cliente aprovar ou recusar.
6. Transformar o orçamento vendido em projeto.
7. Acompanhar ambientes, checklist e produção no Kanban.
8. Controlar materiais, despesas, arquivos e agenda de instalação.
9. Registrar recebimentos, emitir recibos e acompanhar atrasos.
10. Finalizar a entrega e programar o pós-venda.

## Módulos do CRM

### Dashboard

O painel principal apresenta uma visão rápida da operação:

- Total de clientes, projetos ativos, projetos em produção e concluídos.
- Projetos atrasados e entregas previstas para o dia.
- Alertas de parcelas atrasadas ou próximas do vencimento.
- Orçamentos aguardando aprovação, vencidos ou sem resposta há mais de 3 dias.
- Projetos aprovados que passaram 7 dias úteis sem começar.
- Entregas previstas para os próximos dias.
- Pendências de compra, instalações e pós-venda.
- Próximas ações ordenadas por prioridade.
- Distribuição dos projetos por status.
- Atividades recentes e atalhos para os módulos.
- Busca global por clientes, orçamentos e projetos.
- Central de notificações com contador de pendências.
- Mapa de clientes carregado somente quando solicitado, para não deixar o Dashboard pesado.
- Alertas e próximas ações com cache curto para reduzir consultas repetidas sem exibir dados antigos por muito tempo.

### Clientes

- Cadastro de nome, CPF ou CNPJ opcional, telefone, WhatsApp e e-mail.
- Endereço completo com preenchimento por CEP.
- Observações internas.
- Histórico de projetos e orçamentos relacionados.
- Acesso rápido ao WhatsApp.
- Busca e paginação.
- Geocodificação do endereço.
- Mapa interativo com ruas, marcadores e zoom.
- Distância aproximada em linha reta entre a Vertex e cada cliente.
- Link para abrir a rota completa no Google Maps.

O endereço e o CPF ou CNPJ ajudam a completar os documentos, mas não impedem o envio da proposta.

### Orçamentos

O módulo de orçamentos foi feito para acelerar a montagem de propostas de móveis planejados:

- Cadastro do cliente, título, validade e prazo de entrega.
- Ambientes residenciais e comerciais.
- Lista de móveis filtrada automaticamente pelo ambiente escolhido.
- Busca de móveis ignorando acentos e reconhecendo nomes alternativos.
- Modelos rápidos para inserir conjuntos de móveis comuns.
- Móveis avulsos e opção de móvel personalizado.
- Medidas informadas em milímetros.
- Material, acabamento, acessórios e observações por móvel.
- Perfis de preço: padrão, madeirado, provençal e laca externa.
- Formas de cálculo por metro quadrado, metro linear ou unidade.
- Preço manual para serviços e itens especiais.
- Instalação, desconto comercial e custo previsto.
- Cálculo automático de subtotal, custo, lucro previsto e total.
- Revisões do orçamento.
- Exclusão de orçamentos que ainda não foram convertidos.
- Bloqueio de edição e exclusão depois da conversão, preservando o histórico da venda.

#### Dificuldade do móvel

| Nível | Acréscimo |
| --- | ---: |
| Normal | 0% |
| Difícil | 30% |
| Muito difícil | 60% |

#### Preços automáticos padrão

As regras abaixo são os valores iniciais do sistema. Regras cadastradas em **Configurações > Tabela de preços** têm prioridade e permitem atualizar os valores sem alterar o código.

| Item ou perfil | Cálculo | Valor padrão |
| --- | --- | ---: |
| Cozinha padrão | m² | R$ 2.000,00 |
| Cozinha madeirada | m² | R$ 2.500,00 |
| Cozinha provençal | m² | R$ 4.800,00 |
| Cozinha com laca externa | m² | R$ 4.800,00 |
| Armário de dormitório com portas | m² | R$ 1.800,00 |
| Armário de dormitório madeirado | m² | R$ 2.000,00 |
| Closet sem portas | m² | R$ 1.600,00 |
| Closet com portas | m² | R$ 1.800,00 |
| Gabinete de banheiro | m² | R$ 2.800,00 |
| Painel liso | m² | R$ 800,00 |
| Painel ripado | m² | R$ 1.200,00 |
| Porta de giro | m² | R$ 2.600,00 |
| Porta mimetizada | m² | R$ 4.200,00 |
| Prateleira | metro linear | R$ 250,00 |

#### Pagamento do orçamento

- Pagamento a combinar.
- Pix com 3% de desconto automático.
- Cartão em até 24 parcelas.
- Entrada opcional no cartão.
- Data da primeira parcela e vencimentos mensais.
- Ajuste da última parcela para o total fechar exatamente nos centavos.
- Taxa do cartão configurável, considerada no custo e no lucro sem aumentar silenciosamente o total mostrado ao cliente.

### Propostas e aprovação do cliente

Cada orçamento pode gerar dois documentos:

- **Proposta comercial:** apresentação completa, organizada por ambiente, com móveis, medidas, materiais, investimento, condições de pagamento, parcelas, prazo e espaço para assinatura.
- **Orçamento simples:** modelo compacto para conferência e uso operacional.

O CRM também gera um link público de aprovação:

- A proposta abre sem exigir login do cliente.
- O cliente confere os itens e as condições enviadas.
- O cliente pode aprovar ou recusar e deixar uma observação.
- Cada envio guarda uma fotografia dos valores e itens daquela versão.
- Links antigos são invalidados quando uma nova versão é enviada.
- O sistema registra data, versão, aceite, recusa e comprovante.
- Há mensagens prontas para envio e cobrança pelo WhatsApp.
- O CRM alerta quando o cliente está há mais de 3 dias sem responder.

O comprovante registra o aceite comercial no sistema. Ele não substitui uma assinatura digital certificada quando esse tipo de assinatura for exigido juridicamente.

### Vendas

- Funil por status: em orçamento, enviado, aguardando aprovação, aprovado, vendido e perdido.
- Resultado por mês.
- Total vendido no período.
- Taxa de conversão.
- Quantidade aguardando retorno.
- Custo das vendas fechadas.
- Resultado por vendedor para administradores.
- Motivo de perda.
- Lista de clientes que precisam de nova cobrança.

### Projetos

Um orçamento vendido pode ser convertido em projeto sem digitar novamente os dados:

- Cliente, nome, ambientes, valor, custo, entrada e parcelas.
- Responsável pelo projeto.
- Data de aprovação e confirmação de pagamento.
- Prazo de entrega e lembrete para início da produção.
- Observações internas.
- Pagamentos e histórico financeiro.
- Comentários e linha do tempo.
- Materiais, despesas e lucro ajustado.
- Fotos, PDFs e documentos do projeto.
- Mensagens prontas para pedir ou cobrar a aprovação do projeto pelo WhatsApp.
- Agenda de instalação.
- Acompanhamento de pós-venda e garantia.
- Link privado de acompanhamento para o cliente, com andamento, ambientes e previsão de instalação.
- Bloqueio de produção com motivo obrigatório e prazo por etapa.
- Lixeira para recuperar projetos apagados por engano.

#### Prazo operacional

- Prazo padrão de entrega: 30 dias úteis depois da aprovação.
- Lembrete para começar: 7 dias úteis depois da aprovação.
- Fins de semana não entram na contagem.
- Datas são tratadas sem deslocamento de fuso horário para evitar que um vencimento recue um dia.

#### Checklist enxuto

1. Medição.
2. Projeto técnico.
3. Produção.
4. Entrega e instalação.

#### Ambientes do projeto

Cada ambiente é acompanhado separadamente:

- A iniciar.
- Em produção.
- Pronto para instalar.
- Instalado.
- Finalizado.

Isso permite concluir um dormitório sem marcar automaticamente a cozinha, o banheiro ou os demais ambientes como prontos.

### Produção

O Kanban mostra o andamento operacional:

1. Aguardando início.
2. Medição.
3. Projeto.
4. Projeto pronto.
5. Produção.
6. Transporte e instalação.
7. Pronto.

Os cartões podem ser arrastados entre as colunas. A navegação horizontal permite visualizar todas as etapas em telas menores. Projetos concluídos permanecem visíveis por 7 dias e depois saem do Kanban, mas continuam salvos no histórico e podem ser encontrados em **Projetos**.

Projetos bloqueados exibem o motivo diretamente no cartão. Também é possível definir um prazo para a etapa atual, facilitando a cobrança antes do atraso da entrega final.

### Calendário e instalações

- Visualização por mês, semana ou dia.
- Prazos de produção.
- Datas de entrega.
- Parcelas e recebimentos.
- Instalações agendadas.
- Filtro por tipo de evento e atrasos.
- Agenda de equipes e veículos.
- Reserva de equipe e veículo sem conflito de horário.
- Estados da instalação: agendado, confirmado, em rota, em instalação, concluído e cancelado.
- Registro de saída, chegada, conclusão e observações da instalação.

### Financeiro

Disponível para administradores:

- Filtro por mês, situação e busca.
- Recebido no período.
- A receber no período.
- Parcelas atrasadas.
- Valor vendido no mês.
- Custo previsto e custo ajustado.
- Lucro estimado e lucro ajustado.
- Valores futuros.
- Entradas e parcelas.
- Paginação dos lançamentos.
- Exportação financeira.
- Registro de pagamento.
- Reabertura de pagamento.
- Histórico de alterações.
- Emissão de recibo.

Parcelas recebidas nunca são apagadas automaticamente. Ao editar o projeto, o CRM preserva o que já foi recebido e recalcula somente o que está pendente. Uma restrição única impede duas parcelas com o mesmo tipo e número no mesmo projeto.

### Compras, materiais e despesas

- Catálogo de materiais com unidade, custo, acabamento e fornecedor.
- Lista de materiais por projeto.
- Quantidade prevista e quantidade comprada.
- Custo previsto e custo real.
- Situação: precisa comprar, pedido ou recebido.
- Diferença entre previsão e gasto real.
- Painel geral de compras pendentes.
- Registro de mão de obra, frete e outras despesas.
- Recálculo do custo e do lucro real do projeto.

### Fotos e arquivos

- Upload direto para o Vercel Blob.
- Imagens e arquivos PDF.
- Limite de 25 MB por arquivo.
- Categorias para medição, projeto técnico, produção, instalação e entrega.
- Arquivos privados, com download autenticado.
- Exclusão controlada e histórico no projeto.
- Barra de progresso durante o envio.

### Configurações

Administradores podem gerenciar:

- Dados e logotipo da empresa usados nas propostas.
- Usuários, funções, senha, ativação e desativação.
- Regras de preço por ambiente, tipo de móvel, modelo e perfil.
- Materiais, custos, fornecedores e acabamentos padrão.
- Equipes e veículos.
- Backup e saúde do sistema.
- Erros recentes registrados pelo servidor.
- Autenticação em duas etapas com aplicativo autenticador.
- Histórico recente de tentativas de login.
- Lixeira de clientes, orçamentos e projetos, com restauração ou exclusão definitiva.

### Portal de acompanhamento

Cada projeto pode gerar um link exclusivo para o cliente:

- Não exige conta ou senha.
- Mostra somente informações operacionais seguras.
- Exibe etapa atual, progresso, ambientes, prazo e instalação.
- Não mostra custos, lucro, pagamentos, observações internas ou arquivos privados.
- Pode ser revogado e recriado a qualquer momento.
- Expira automaticamente e registra a última visualização.

### Lembretes automáticos

Uma rotina diária cria alertas para produção parada, prazos de etapa, entregas, parcelas vencidas e orçamentos sem resposta. Os alertas aparecem no CRM e podem ser enviados a uma integração externa por webhook.

## Usuários e permissões

| Perfil | Acesso |
| --- | --- |
| Administrador | Visão global, financeiro, compras, usuários, preços, materiais, backups e configurações |
| Gerente | Clientes, orçamentos e projetos sob sua responsabilidade, produção e calendário |
| Consulta | Visualização do sistema sem permissão para alterar dados |

Contas desativadas perdem o acesso. A versão da sessão permite encerrar sessões antigas quando a conta ou a senha é alterada.

## Segurança

- Autenticação com NextAuth e senha protegida por bcrypt.
- Autenticação em duas etapas opcional por TOTP.
- Sessão JWT com duração máxima de 12 horas.
- Limite de 5 tentativas de login a cada 15 minutos por IP e e-mail.
- Limites de requisição nas APIs.
- Rate limit compartilhado pelo PostgreSQL, com suporte opcional ao Upstash Redis.
- Verificação de função e propriedade dos projetos no servidor.
- Perfil de consulta bloqueado para qualquer alteração.
- Tokens aleatórios e com validade para aprovação pública.
- Tokens do portal armazenados com hash e cópia criptografada para permitir revogação e compartilhamento controlado.
- IP armazenado como hash no registro de aprovação.
- Cabeçalhos de segurança, CSP, HSTS em produção e proteção contra abertura em iframe.
- Validação de dados com Zod.
- Arquivos de ambiente, bancos locais, logs e backups ignorados pelo Git.
- Registro de atividades, pagamentos, aprovações, backups e erros importantes.
- Registro de sucesso e falha de login sem guardar o endereço IP em texto aberto.
- Valores financeiros armazenados em `Decimal(14,2)` para preservar os centavos.
- Exclusão lógica de clientes, orçamentos e projetos antes da remoção definitiva.

Nunca envie `.env.local`, senhas, tokens, arquivos de backup ou a chave de criptografia para o GitHub.

## Tecnologias

- Next.js 16 com App Router.
- React 19 e TypeScript.
- Tailwind CSS 4.
- PostgreSQL e Prisma ORM.
- NextAuth com autenticação por credenciais.
- Vercel Blob para arquivos privados.
- Leaflet e OpenStreetMap para o mapa.
- Recharts para gráficos.
- dnd-kit para o Kanban.
- React Hook Form e Zod para formulários.
- Lucide para ícones.

## Estrutura principal

```text
app/
  acompanhar/           Portal público de andamento do projeto
  api/                 APIs autenticadas e públicas
  dashboard/           Telas internas do CRM
  login/               Entrada no sistema
  proposta/            Aprovação pública do orçamento
components/
  calendar/            Calendário e agenda operacional
  clients/             Formulários de clientes
  dashboard/           Indicadores, mapa e gráficos
  kanban/              Produção
  projects/            Projeto, materiais, despesas e arquivos
  quotes/              Orçamentos e seleção de móveis
  settings/            Configurações administrativas
lib/                   Regras de negócio, segurança e cálculos
prisma/
  migrations/          Histórico de alterações do PostgreSQL
  schema.prisma        Modelo de dados
scripts/               Backup, migração, segurança e tarefas do Windows
tests/                 Testes automatizados
e2e/                   Testes de navegador em computador e celular
```

## Requisitos para desenvolvimento

- Node.js 20 LTS ou mais recente.
- npm.
- Banco PostgreSQL.
- Token do Vercel Blob para testar upload de arquivos.

## Variáveis de ambiente

Crie um arquivo `.env.local`. Não use valores reais em arquivos versionados.

```dotenv
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
NEXTAUTH_SECRET="uma-chave-longa-e-aleatoria"
NEXTAUTH_URL="http://localhost:3000"
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
NEXT_PUBLIC_VERTEX_ADDRESS="Rua Saturno 6, Cotia, SP, 06702-170"
CRON_SECRET="uma-chave-longa-e-aleatoria"
BACKUP_ENCRYPTION_KEY="outra-chave-longa-e-aleatoria"
```

Variáveis opcionais:

| Variável | Finalidade |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Backend Redis opcional para rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Upstash Redis |
| `BACKUP_DIRECTORY` | Pasta principal dos backups |
| `BACKUP_SECONDARY_DIR` | Segunda cópia, por exemplo uma pasta sincronizada com OneDrive |
| `BACKUP_RETENTION_DAYS` | Retenção, com padrão de 30 dias |
| `BACKUP_ENCRYPTION_KEY` | Chave externa para criptografar e recuperar backups |
| `BACKUP_KEY_FILE` | Caminho alternativo do arquivo local da chave |
| `CRON_SECRET` | Protege as rotinas automáticas da Vercel |
| `REMINDER_WEBHOOK_URL` | Endpoint HTTPS opcional para enviar lembretes externos |
| `REMINDER_WEBHOOK_SECRET` | Segredo opcional enviado no webhook de lembretes |
| `ADMIN_NAME` | Nome usado ao provisionar o primeiro administrador |
| `ADMIN_EMAIL` | E-mail usado ao provisionar o primeiro administrador |
| `ADMIN_PASSWORD` | Senha usada ao provisionar o primeiro administrador |

## Instalação local

```powershell
git clone https://github.com/vertexmoveis/vertex-moveis-gestao.git
cd vertex-moveis-gestao
npm ci
npm run prisma:generate
npm run db:deploy
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Primeiro administrador

Defina uma senha com pelo menos 14 caracteres, letra maiúscula, letra minúscula, número e símbolo:

```powershell
$env:ADMIN_NAME="Administrador Vertex"
$env:ADMIN_EMAIL="admin@vertexmoveis.com.br"
$env:ADMIN_PASSWORD="defina-uma-senha-forte"
npm run admin:provision
```

Remova as variáveis da sessão do PowerShell depois do uso:

```powershell
Remove-Item Env:ADMIN_NAME,Env:ADMIN_EMAIL,Env:ADMIN_PASSWORD
```

## Comandos

| Comando | Função |
| --- | --- |
| `npm run dev` | Inicia o desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Inicia o build na porta 3000 |
| `npm run lint` | Executa o ESLint |
| `npm test` | Executa os testes automatizados |
| `npm run test:e2e` | Testa login, proteção do painel e PWA em desktop e celular |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run db:deploy` | Aplica migrações pendentes |
| `npm run admin:provision` | Cria ou atualiza o primeiro administrador |
| `npm run backup:db` | Cria um backup manual |
| `npm run backup:daily` | Registra o backup diário no Windows |
| `npm run security:audit-data` | Procura dados de teste sem exibir informações completas |
| `npm run security:demo-users -- --action=list` | Lista usuários suspeitos de teste |
| `npm run test:security` | Executa a suíte de segurança |
| `npm audit --omit=dev` | Verifica vulnerabilidades nas dependências de produção |

## Backup

O CRM possui duas formas de backup: uma cópia local executada por um computador confiável e uma cópia privada diária no Vercel Blob.

```powershell
npm run backup:db
```

O processo:

1. Lê todas as tabelas persistentes do PostgreSQL.
2. Gera um arquivo criptografado com AES-256-GCM.
3. Verifica a integridade do arquivo.
4. Restaura o conteúdo em um schema temporário.
5. Confere a quantidade de registros de cada tabela.
6. Exclui o schema temporário.
7. Mantém 30 dias por padrão.
8. Cria uma segunda cópia quando `BACKUP_SECONDARY_DIR` está configurada.
9. Registra sucesso ou falha na saúde do sistema.

Na produção, `/api/cron/backup` executa diariamente às 18h no horário de São Paulo. A cópia em nuvem também é criptografada, verificada e mantém 30 dias de histórico. A chave de criptografia não deve ser perdida, pois ela é necessária para restaurar os dados.

Para cadastrar a tarefa diária das 18h no Windows:

```powershell
npm run backup:daily
```

Importante: um backup criptografado só pode ser restaurado com a chave correta. Se a chave for criada no computador local, guarde uma cópia separada e protegida. A opção mais segura é definir `BACKUP_ENCRYPTION_KEY` em um gerenciador de senhas e manter a segunda cópia em outro local físico.

## Testes e validação

Antes de enviar uma alteração:

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
npm audit --audit-level=moderate
npm run test:security
```

O teste de segurança usa um schema isolado do PostgreSQL, guarda temporariamente o arquivo `.env.production.local` existente e o restaura ao final, mesmo quando ocorre uma falha.

Os testes atuais cobrem:

- Datas sem erro de fuso horário.
- Cálculos de orçamento, Pix, cartão, parcelas e dificuldade.
- Catálogo e busca de móveis por ambiente.
- Requisitos para enviar a proposta.
- CPF ou CNPJ opcional.
- Cálculo de custo real do projeto.
- Segurança do upload para o Vercel Blob.
- Cobertura de todas as tabelas no backup.
- Precisão de valores em centavos.
- Criptografia e integridade do backup.
- Token e criptografia do portal de acompanhamento.
- Autenticação em duas etapas.
- Login, redirecionamento protegido e manifesto PWA em desktop e celular.
- Permissões entre administradores, gerentes e usuários de consulta.

## Publicação

O projeto está preparado para Vercel:

- `vercel.json` executa `npm run vercel-build`.
- Migrações são aplicadas automaticamente apenas no build de produção.
- O build tenta aplicar as migrações até três vezes antes de falhar.
- Banco, autenticação e Blob devem estar configurados nas variáveis do projeto.
- Um push na `main` publica uma nova versão quando o repositório está conectado à Vercel.

Publicação manual:

```powershell
npx vercel --prod
```

## Melhorias recomendadas

Prioridades sugeridas para as próximas versões:

1. **Testar uma restauração externa completa.** Recuperar o CRM em outro banco usando somente a cópia em nuvem e a chave guardada fora da Vercel.
2. **Integrar WhatsApp oficial.** Enviar lembretes de aprovação, cobrança, instalação e pós-venda sem depender da abertura manual da conversa.
3. **Ampliar os testes de navegador autenticados.** Cobrir orçamento, aprovação, conversão em projeto, pagamento, recibo, upload e conclusão com uma conta exclusiva de testes.
4. **Monitorar desempenho e uploads.** Medir tempo e falhas do Vercel Blob, banco e páginas, com aviso externo quando houver erro repetido.
5. **Escalar produção e compras.** Adicionar carregamento progressivo quando o Kanban ultrapassar 250 projetos ou a lista de compras crescer muito.
6. **Verificar arquivos enviados.** Adicionar varredura de malware e regras de retenção para PDFs e imagens.
7. **Completar a acessibilidade.** Testar todos os fluxos por teclado, contraste e leitores de tela.

---

Desenvolvido para a operação da **Vertex Móveis**.
