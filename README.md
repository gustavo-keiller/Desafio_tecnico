# Gestao de Pedidos - ERP & Concorrencia de Estoque

Solucao completa para o desafio tecnico de **Gestao de Pedidos** com controle transacional de estoque, concorrencia pessimista, fila de execucao priorizada, gerenciamento de usuarios com RBAC e matriz de permissoes granulares.

---

## Tecnologias Utilizadas
- **Backend:** NestJS, TypeScript, TypeORM, Swagger/OpenAPI, Class-Validator
- **Banco de Dados:** Microsoft SQL Server (Docker Compose) / SQLite em memoria (Testes)
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS Responsivo
- **Testes & Qualidade:** Jest, Supertest, ESLint 9

---

## Como Executar o Projeto

### 1. Iniciar o Banco de Dados (SQL Server)
```bash
docker compose up -d
```

### 2. Iniciar o Backend
```bash
cd backend
npm install

# Opcao A: Carga Completa de Demonstracao (Produtos com estoque, Alice VIP, Bob, Sally, Joe)
npm run seed

# Opcao B: Reiniciar Limpo (Mantem APENAS o Super Admin e matriz de permissoes)
npm run seed:clean

npm run start:dev
```
- **API Base:** `http://localhost:3001`
- **Swagger / Documentacao:** `http://localhost:3001/api`

### 3. Iniciar o Frontend
```bash
cd frontend
npm install
npm run dev
```
- **Aplicacao Web:** `http://localhost:3000`

---

## Perfis de Acesso & Matriz de Permissoes (RBAC)

O sistema possui 4 categorias de perfis e suporte a **permissoes atomicas granulares**:

| Perfil | Descricao | Permissoes Padrao |
|---|---|---|
| **Super Admin** | Acesso total e configuracao | Todas as 14 permissoes ativas + Gerenciamento de Usuarios, Clientes VIPs e Matriz |
| **Vendedor** (`Seller`) | Vendas e aprovacao comercial | Criar Pedidos, Ver Todos os Pedidos, Aprovar Pedidos, Ver Clientes e Produtos |
| **Cliente** (`Client`) | Comprador final | Criar Pedidos, Ver Proprios Pedidos, Editar/Cancelar Proprios Itens em Aberto |
| **Gerente de Estoque** (`InventoryManager`) | Operacao de armazem | Repor Estoque, Iniciar Separacao (Reservar Estoque), Concluir Pedido (Faturamento), Extrato de Movimentacoes |

### Controle de Permissoes
- **Por Cargo:** O Super Admin pode ativar ou desativar qualquer permissao atomica para qualquer cargo na aba **"Matriz de Permissoes por Cargo"** em `/admin/usuarios`.
- **Por Usuario:** O Super Admin pode restringir permissoes individualmente por usuario atraves do painel de edicao de permissoes (com teto maximo restrito as permissoes do seu cargo).
- **Status VIP:** Restrito exclusivamente a contas de **Cliente**, concedendo 10% de desconto contratual e prioridade alta no processamento da fila de estoque.

---

## Respostas as Questoes Obrigatorias do Desafio

### 1. Como voce impediu duas reservas simultaneas de consumirem o mesmo saldo?
Implementamos uma estrategia em 4 camadas de defesa:
1. **Bloqueio Pessimista no Banco (`Pessimistic Write Lock`)**: Durante a execucao da reserva, o TypeORM executa `SELECT ... WITH (UPDLOCK, ROWLOCK)` no SQL Server para a linha de estoque do produto via helper centralizado `applyStockMutation`. Nenhuma outra transacao concorrente consegue ler para alterar ou decrementar o saldo ate que a transacao em andamento seja finalizada.
2. **Prevencao Ativa de Deadlocks**: Todos os itens do pedido sao ordenados deterministicamente por `productId` antes de adquirir os locks no banco, eliminando concorrencia cruzada e deadlocks circulares.
3. **Restricao Fisica de Integridade (`Check Constraint`)**: Constraint fisica `availableQuantity >= 0` e `@Column({ unique: true }) productId` na tabela `stocks`. Se qualquer instrucao tentar violar o saldo positivo ou duplicar o estoque, o banco aborta a transacao imediatamente.
4. **Fila Priorizada de Processamento (`OrderQueueService`)**: Gerencia a ordem de chegada com prioridade para reposicoes, cancelamentos e clientes VIPs.

### 2. O que esta protegido por transacao e por que?
Estao protegidas por transacoes explicitas (`dataSource.transaction`) todas as operacoes de mutacao de estado:
- **Criacao de Pedidos e Itens**: Garante que o cabecalho do pedido e todos os itens sejam criados juntos ou nada.
- **Reserva de Estoque / Separacao**: Agrupa atomicamente o lock de estoque, decremento de saldo, criacao do registro em `stock_reservations`, registro de auditoria contabil em `stock_movements` e atualizacao do status para `RESERVED`.
- **Confirmacao / Faturamento**: Baixa definitiva das reservas temporarias e transicao para `FINISHED`.
- **Cancelamento de Pedido**: Devolucao integral do saldo em `stocks`, remocao das reservas, log de estorno e mudanca para `CANCELED`.
- **Alteracao de Itens em Pedidos Reservados**: Recalculo de diferenca (delta), ajuste atomico de reservas e atualizacao de valores.
- **Reposicao de Estoque**: Incremento de saldo com lock e registro de movimentacao `IN`.
*Motivo*: Evitar inconsistencia de dados, saldo fantasma ou pedidos em estados intermediarios orfaos em caso de falha transitoria ou erro de rede.

### 3. Quais decisoes voce mudaria se o sistema tivesse alto volume de pedidos?
1. **Fila Distribuida Persistente (Redis + BullMQ / RabbitMQ)**: Substituir a fila in-memory por uma infraestrutura distribuida com multiplos workers paralelos, retentativas exponenciais e Dead-Letter Queue (DLQ).
2. **Particionamento por Chave de Produto**: Em vez de uma fila global, particionar filas por `productId` ou hash. Pedidos de produtos distintos executam em paralelo, enquanto pedidos do mesmo produto sao serializados.
3. **Reserva Temporaria com TTL em Cache (Redis Distributed Lock)**: Utilizar locks de curta duracao (ex: Redlock) para segurar o carrinho por 10 minutos, persistindo no SQL Server apenas no fechamento do checkout.
4. **Event Sourcing / CQRS**: Separar banco de leitura (otimizado para consultas e relatorios) do banco de escrita transacional (SQL Server com replicacao).

### 4. O que ficou fora do escopo por causa do limite de tempo?
- Integracao com gateway de pagamentos real (ex: Pix / Cartao / Webhooks).
- Autenticacao JWT com Refresh Tokens e MFA (utilizamos autenticacao por cabecalho `x-user-id` e `x-user-role` validado contra o banco para facilitar os testes rapidos e simulacao de personas).
- Exportacao de relatorios fiscais em PDF / Excel.

---

## Testes Automatizados & Validacao

### 1. Testes Unitarios (Jest Mocks)
Valida a fila de prioridades, metricas de telemetria, tratamento de erros e matriz de permissoes RBAC:
```bash
cd backend
npm test
```

### 2. Testes E2E (Jest & Supertest)
Valida a integridade transacional, regras RBAC e concorrencia ponta a ponta:
```bash
cd backend
npm run test:e2e
```

### 3. Teste de Estresse & Concorrencia Extrema (Anti-Overbooking & Latencia)
Dispara requisicoes simultaneas de clientes concorrentes disputando o mesmo estoque limitado, avalia a fila de prioridades, throughput (RPS) e latencias (p50, p95, p99):
```bash
cd backend
npm run test:stress
```
*Ou a partir da raiz do projeto:*
```bash
node scripts/stress-test.mjs
```

---

## Postman Collection & Environment

Os arquivos prontos para importacao no Postman estao localizados no diretorio `postman/`:
- `Gestao_de_Pedidos_ERP.postman_collection.json`: Rotas organizadas por modulos com scripts de captura de variaveis (`orderId`, `productId`, `customerId`).
- `Gestao_de_Pedidos_ERP.postman_environment.json`: Variaveis de ambiente configuradas com os perfis do seed (`Admin`, `Seller`, `Client`, `InventoryManager`).

Consulte o [Guia do Postman](file:///c:/Users/igork/Documents/antigravity/radiant-lavoisier/postman/README.md) para mais detalhes.


