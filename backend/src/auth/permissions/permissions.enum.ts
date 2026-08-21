export enum Permission {
  USERS_MANAGE = 'users:manage',
  ORDERS_READ_ALL = 'orders:read_all',
  ORDERS_READ_OWN = 'orders:read_own',
  ORDERS_CREATE = 'orders:create',
  ORDERS_APPROVE = 'orders:approve',
  ORDERS_RESERVE = 'orders:reserve',
  ORDERS_CONFIRM = 'orders:confirm',
  ORDERS_UPDATE_ITEMS = 'orders:update_items',
  ORDERS_CANCEL = 'orders:cancel',
  PRODUCTS_READ = 'products:read',
  PRODUCTS_CREATE = 'products:create',
  INVENTORY_READ = 'inventory:read',
  INVENTORY_REPLENISH = 'inventory:replenish',
  CUSTOMERS_READ = 'customers:read',
}

export interface PermissionDefinition {
  code: Permission;
  name: string;
  category: 'Usuários' | 'Pedidos' | 'Produtos & Estoque' | 'Clientes';
  description: string;
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  {
    code: Permission.USERS_MANAGE,
    name: 'Gerenciar Usuários & Permissões',
    category: 'Usuários',
    description: 'Criar, editar e excluir usuários, além de alterar a matriz de permissões por cargo.',
  },
  {
    code: Permission.ORDERS_READ_ALL,
    name: 'Ver Todos os Pedidos',
    category: 'Pedidos',
    description: 'Visualizar pedidos de qualquer cliente no sistema.',
  },
  {
    code: Permission.ORDERS_READ_OWN,
    name: 'Ver Próprios Pedidos',
    category: 'Pedidos',
    description: 'Visualizar apenas os pedidos criados pelo próprio usuário.',
  },
  {
    code: Permission.ORDERS_CREATE,
    name: 'Criar Pedidos',
    category: 'Pedidos',
    description: 'Cadastrar novos pedidos de venda.',
  },
  {
    code: Permission.ORDERS_APPROVE,
    name: 'Aprovar Pedidos',
    category: 'Pedidos',
    description: 'Aprovar comercialmente pedidos pendentes (Criado -> Aprovado).',
  },
  {
    code: Permission.ORDERS_RESERVE,
    name: 'Iniciar Separação / Reservar Estoque',
    category: 'Pedidos',
    description: 'Anunciar início da separação física e bloquear saldo de estoque (Aprovado -> Em Separação).',
  },
  {
    code: Permission.ORDERS_CONFIRM,
    name: 'Finalizar Separação / Concluir Pedido',
    category: 'Pedidos',
    description: 'Confirmar finalização da separação e faturamento (Em Separação -> Concluído).',
  },
  {
    code: Permission.ORDERS_UPDATE_ITEMS,
    name: 'Editar Itens do Pedido',
    category: 'Pedidos',
    description: 'Alterar itens e quantidades de um pedido existente.',
  },
  {
    code: Permission.ORDERS_CANCEL,
    name: 'Cancelar Pedidos',
    category: 'Pedidos',
    description: 'Cancelar pedidos e liberar reservas de estoque.',
  },
  {
    code: Permission.PRODUCTS_READ,
    name: 'Ver Produtos',
    category: 'Produtos & Estoque',
    description: 'Visualizar o catálogo de produtos e preços.',
  },
  {
    code: Permission.PRODUCTS_CREATE,
    name: 'Criar Produtos',
    category: 'Produtos & Estoque',
    description: 'Cadastrar novos produtos no catálogo.',
  },
  {
    code: Permission.INVENTORY_READ,
    name: 'Ver Estoque',
    category: 'Produtos & Estoque',
    description: 'Visualizar a quantidade de estoque de cada produto.',
  },
  {
    code: Permission.INVENTORY_REPLENISH,
    name: 'Repor Estoque',
    category: 'Produtos & Estoque',
    description: 'Adicionar saldo de estoque aos produtos.',
  },
  {
    code: Permission.CUSTOMERS_READ,
    name: 'Ver Clientes',
    category: 'Clientes',
    description: 'Visualizar a lista de clientes cadastrados.',
  },
];
