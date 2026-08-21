# Gestão de Pedidos - ERP & Concorrência de Estoque

Solução completa para o desafio técnico de **Gestão de Pedidos** com controle transacional de estoque, concorrência pessimista, fila de execução, gerenciamento de usuários com RBAC e matriz de permissões granulares.

---

## 🛠️ Tecnologias Utilizadas
- **Backend:** NestJS, TypeScript, TypeORM, Swagger/OpenAPI, Class-Validator
- **Banco de Dados:** Microsoft SQL Server (Docker Compose)
- **Frontend:** Next.js (App Router), TypeScript, Vanilla CSS Responsivo

---

## 🚀 Como Executar o Projeto

### 1. Iniciar o Banco de Dados (SQL Server)
```bash
docker compose up -d
```

### 2. Iniciar o Backend
```bash
cd backend
npm install
npm run seed   # Cria o esquema, carrega usuários, produtos e a matriz de permissões
npm run start:dev
```
- **API Base:** `http://localhost:3001`
- **Swagger / Documentação:** `http://localhost:3001/api`

### 3. Iniciar o Frontend
```bash
cd frontend
npm install
npm run dev
```
- **Aplicação Web:** `http://localhost:3000`

---

## 👥 Perfis de Acesso & Matriz de Permissões

O sistema possui 4 categorias de perfis e suporte a **permissões atômicas granulares**:

| Perfil | Descrição | Permissões Padrão |
|---|---|---|
| **Super Admin** | Acesso total e gerenciamento | Todas as 14 permissões ativas + Gerenciamento de Usuários, Clientes VIPs e Matriz |
| **Vendedor** (`Seller`) | Vendas e aprovação comercial | Criar Pedidos, Ver Todos os Pedidos, Aprovar Pedidos, Ver Clientes/Produtos |
| **Cliente** (`Client`) | Comprador final | Criar Pedidos, Ver Próprios Pedidos, Editar/Cancelar Próprios Itens em Aberto |
| **Gerente de Estoque** (`InventoryManager`) | Operação de armazém | Repor Estoque, Iniciar Separação (Reservar Estoque), Concluir Pedido (Faturamento), Extrato de Movimentações |

### 🔒 Controle Fino de Permissões
- **Por Cargo:** O Super Admin pode ativar/desativar qualquer permissão atômica para qualquer cargo na aba **"Matriz de Permissões por Cargo"** em `/admin/usuarios`.
- **Por Usuário:** O Super Admin pode restringir permissões individualmente por usuário através do painel **"🔒 Permissões"** (com teto máximo restrito às permissões do seu cargo).

---

## 🛡️ Respostas às Questões Obrigatórias do Desafio

### 1. Como você impediu duas reservas simultâneas de consumirem o mesmo saldo?
Implementamos uma estratégia em 3 camadas de defesa:
1. **Bloqueio Pessimista no Banco (`Pessimistic Write Lock`)**: Durante a execução da reserva, o TypeORM executa `SELECT ... WITH (UPDLOCK, ROWLOCK)` no SQL Server para a linha de estoque do produto. Nenhuma outra transação consegue ler para alterar ou decrementar o saldo até que a primeira seja commitada.
2. **Prevenção Ativa de Deadlocks**: Todos os itens do pedido são ordenados deterministicamente por `productId` antes de adquirir os locks no banco, eliminando concorrência cruzada e deadlocks circulares.
3. **Restrição Física de Integridade (`Check Constraint`)**: Criamos a constraint `availableQuantity >= 0` na tabela `stocks`. Se qualquer instrução tentar violar o saldo positivo, o banco aborta a transação.
4. **Fila Priorizada de Processamento (`OrderQueueService`)**: Gerencia a ordem de chegada com prioridade para reposições, cancelamentos e clientes VIPs.

### 2. O que está protegido por transação e por quê?
Estão protegidas por transações explícitas (`dataSource.transaction`) todas as operações de mutação de estado:
- **Criação de Pedidos e Itens**: Garante que o cabeçalho do pedido e todos os itens sejam criados juntos ou nada.
- **Reserva de Estoque / Separação**: Agrupa atomicamente o lock de estoque, decremento de saldo, criação do registro em `stock_reservations`, registro de auditoria em `stock_movements` e atualização do status para `RESERVED`.
- **Confirmação / Faturamento**: Baixa definitiva das reservas, registro de consumo e transição para `FINISHED`.
- **Cancelamento de Pedido**: Devolução integral do saldo em `stocks`, remoção das reservas, log de estorno e mudança para `CANCELADO`.
- **Reposição de Estoque**: Incremento de saldo com lock e registro de movimentação `IN`.
*Motivo*: Evitar inconsistência de dados, saldo fantasma ou pedidos em estados intermediários órfãos em caso de falha transitória ou erro de rede.

### 3. Quais decisões você mudaria se o sistema tivesse alto volume de pedidos?
1. **Fila Distribuída Persistente (Redis + BullMQ / RabbitMQ)**: Substituir a fila in-memory por uma infraestrutura distribuída com múltiplos workers paralelos, retentativas exponenciais e Dead-Letter Queue (DLQ).
2. **Particionamento por Chave de Produto**: Em vez de uma fila global, particionar filas por `productId` ou hash. Pedidos de produtos distintos executam em paralelo, enquanto pedidos do mesmo produto são serializados.
3. **Reserva Temporária com TTL em Cache (Redis Distributed Lock)**: Utilizar locks de curta duração (ex: Redlock) para segurar o carrinho por 10 minutos, persistindo no SQL Server apenas no fechamento do checkout.
4. **Event Sourcing / CQRS**: Separar banco de leitura (otimizado para consultas e relatórios) do banco de escrita transacional (SQL Server com replicação).

### 4. O que ficou fora do escopo por causa do limite de tempo?
- Integração com gateway de pagamentos real (ex: Pix / Cartão / Webhooks).
- Autenticação JWT com Refresh Tokens e MFA (utilizamos autenticação simplificada por cabeçalho `x-user-id` validado contra o banco para facilitar os testes rápidos).
- Exportação de relatórios fiscais em PDF / Excel.

---

## 🧪 Testes Automatizados
Para executar a suíte de testes E2E com validação de fluxos RBAC e concorrência:
```bash
cd backend
npm run test:e2e
```
