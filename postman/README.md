# 📮 Coleção Postman & Guia de Testes da API

Este diretório contém a Collection completa do Postman e o arquivo de Environment para testes de integração e validação das regras de negócio do sistema de **Gestão de Pedidos ERP**.

---

## 📁 Arquivos Inclusos

1. [`Gestao_de_Pedidos_ERP.postman_collection.json`](file:///c:/Users/igork/Documents/antigravity/radiant-lavoisier/postman/Gestao_de_Pedidos_ERP.postman_collection.json): Contém todas as rotas e requisições organizadas por módulo.
2. [`Gestao_de_Pedidos_ERP.postman_environment.json`](file:///c:/Users/igork/Documents/antigravity/radiant-lavoisier/postman/Gestao_de_Pedidos_ERP.postman_environment.json): Variáveis de ambiente com URLs e IDs dos usuários para alternar perfis rapidamente.

---

## 📥 Como Importar no Postman

1. Abra o Postman (Desktop ou Web).
2. Clique no botão **"Import"** no canto superior esquerdo.
3. Arraste e solte os dois arquivos (`Gestao_de_Pedidos_ERP.postman_collection.json` e `Gestao_de_Pedidos_ERP.postman_environment.json`).
4. No canto superior direito do Postman, selecione o ambiente **"Gestão de Pedidos - Local Environment"**.

---

## 👥 Perfis de Acesso e Autenticação (`x-user-id`)

A autenticação é realizada enviando o header `x-user-id` com o ID do usuário cadastrado no banco:

| Perfil | Variável de Ambiente | ID do Usuário (Seed) | Papel / Permissões |
|---|---|---|---|
| **Super Admin** | `{{adminUserId}}` | `44444444-4444-4444-4444-444444444444` | Acesso total e gerenciamento de usuários / matriz RBAC |
| **Vendedor (Sally)** | `{{sellerUserId}}` | `66666666-6666-6666-6666-666666666666` | Criação e aprovação de pedidos |
| **Gerente Estoque (Joe)**| `{{inventoryUserId}}` | `33333333-3333-3333-3333-333333333333` | Separação, reserva de estoque, reposição e faturamento |
| **Cliente VIP (Alice)** | `{{clientVipUserId}}` | `11111111-1111-1111-1111-111111111111` | Criação de pedidos com 10% de desconto e prioridade |
| **Cliente Padrão (Bob)** | `{{clientStandardUserId}}`| `22222222-2222-2222-2222-222222222222` | Criação e acompanhamento dos próprios pedidos |

> **Dica:** Para alternar o usuário ativo em qualquer requisição, basta alterar o valor da variável `activeUserId` no Environment para o perfil desejado.

---

## 🔄 Fluxo Recomendado de Teste no Postman

1. **Catálogo & Estoque**:
   - `2.1 Listar Produtos` (o Postman salva automaticamente o primeiro `productId` nas variáveis).
   - `2.4 Repor Estoque` (garante saldo para testes).
2. **Ciclo de Vida do Pedido**:
   - `1.5 Criar Pedido (Cliente VIP)` ou `1.6 Criar Pedido (Vendedor)` (salva o `orderId` gerado).
   - `1.8 Aprovar Pedido` (`ORDERED` -> `APPROVED`).
   - `1.9 Iniciar Separação / Reservar Estoque` (`APPROVED` -> `RESERVED` com lock pessimista).
   - `1.10 Concluir Separação / Faturar Pedido` (`RESERVED` -> `FINISHED`).
   - `2.5 Extrato de Movimentações de Estoque` (visualiza o log contábil `IN`, `RESERVE`, `OUT`).
3. **Gerenciamento & RBAC**:
   - `4.1 Listar Usuários` / `5.2 Matriz de Permissões por Cargo`.
