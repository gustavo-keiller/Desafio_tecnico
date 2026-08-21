import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from '../src/orders/orders.module';
import { ProductsModule } from '../src/products/products.module';
import { CustomersModule } from '../src/customers/customers.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PermissionsModule } from '../src/auth/permissions/permissions.module';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/entities/user.entity';
import { Customer } from '../src/entities/customer.entity';
import { Product } from '../src/entities/product.entity';
import { Stock } from '../src/entities/stock.entity';
import { Order } from '../src/entities/order.entity';
import { OrderItem } from '../src/entities/order-item.entity';
import { StockReservation } from '../src/entities/stock-reservation.entity';
import { StockMovement } from '../src/entities/stock-movement.entity';
import { RolePermission } from '../src/entities/role-permission.entity';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/auth/permissions/permissions.service';

describe('Gestão de Pedidos ERP - Testes E2E', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let dataSource: DataSource;

  // Real Seeded User IDs
  const client1Id = '11111111-1111-1111-1111-111111111111'; // Alice (Cliente)
  const client2Id = '22222222-2222-2222-2222-222222222222'; // Bob (Cliente)
  const managerId = '33333333-3333-3333-3333-333333333333'; // Joe (Gerente Estoque)
  const adminId = '44444444-4444-4444-4444-444444444444';   // Super Admin
  const sellerId = '66666666-6666-6666-6666-666666666666';  // Sally (Vendedor)

  let productAId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Customer, Product, Stock, Order, OrderItem, StockReservation, StockMovement, User, RolePermission],
          synchronize: true,
          dropSchema: true,
        }),
        OrdersModule,
        ProductsModule,
        CustomersModule,
        AuthModule,
        UsersModule,
        PermissionsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);

    // Ensure Role Permissions
    const rolePermissionRepo = dataSource.getRepository(RolePermission);
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await rolePermissionRepo.save({ role, permissions });
    }

    // Ensure Users
    const userRepo = dataSource.getRepository(User);
    await userRepo.save([
      { id: client1Id, name: 'Alice (Cliente VIP)', email: 'alice@example.com', role: UserRole.CLIENT, isVip: true },
      { id: client2Id, name: 'Bob (Cliente)', email: 'bob@example.com', role: UserRole.CLIENT, isVip: false },
      { id: managerId, name: 'Joe (Gerente Estoque)', email: 'joe@example.com', role: UserRole.INVENTORY_MANAGER, isVip: false },
      { id: adminId, name: 'Super Admin', email: 'admin@example.com', role: UserRole.ADMIN, isVip: false },
      { id: sellerId, name: 'Sally (Vendedor)', email: 'sally@example.com', role: UserRole.SELLER, isVip: false },
    ]);

    // Ensure Customers
    const customerRepo = dataSource.getRepository(Customer);
    await customerRepo.save([
      { id: client1Id, name: 'Alice Smith', email: 'alice@example.com', isVip: true },
      { id: client2Id, name: 'Bob Jones', email: 'bob@example.com', isVip: false },
    ]);

    // Ensure Initial Product
    const productRepo = dataSource.getRepository(Product);
    const stockRepo = dataSource.getRepository(Stock);
    const prodA = await productRepo.save({ name: 'Produto Teste A', price: 100 });
    productAId = prodA.id;
    await stockRepo.save({ productId: productAId, availableQuantity: 10 });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Fluxo A & RBAC: Criação e Reserva de Pedidos', () => {
    it('deve permitir que o Vendedor busque clientes', async () => {
      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('deve permitir que o Cliente busque produtos', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      productAId = res.body[0].id;
    });

    let orderId = '';

    it('Cliente deve conseguir criar um pedido', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .send({
          items: [{ productId: productAId, quantity: 1 }],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.customerId).toBe(client1Id);
      orderId = res.body.id;
    });

    it('Vendedor NÃO deve conseguir reservar estoque diretamente sem permissão', async () => {
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/reserve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(403);
    });

    it('Cliente NÃO deve conseguir iniciar separação/reservar estoque', async () => {
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/reserve`)
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .expect(403);
    });

    it('Gerente de Estoque deve conseguir iniciar a separação após aprovação do vendedor', async () => {
      // 1. Aprovar o pedido como Vendedor
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/approve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(201);

      // 2. Iniciar separação como Gerente de Estoque
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/reserve`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(201);
    });

    it('Outro cliente NÃO deve conseguir cancelar este pedido de terceiro', async () => {
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('x-user-id', client2Id)
        .set('x-user-role', 'Client')
        .expect(403);
    });
  });

  describe('Fluxo B & RBAC: Reposição de Estoque', () => {
    it('Cliente NÃO deve conseguir repor estoque', async () => {
      await request(app.getHttpServer())
        .post('/inventory/replenish')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .send({ productId: productAId, quantity: 50 })
        .expect(403);
    });

    it('Gerente de Estoque deve conseguir repor estoque', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/replenish')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ productId: productAId, quantity: 50 })
        .expect(201);

      expect(res.body.availableQuantity).toBeDefined();
    });
  });

  describe('Fluxo C & Concorrência: Prevenção de Estoque Negativo e Conflito de Reservas', () => {
    it('Deve tratar reservas concorrentes e impedir estoque negativo', async () => {
      // 1. Criar novo produto isolado para teste
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ name: 'Produto Teste Concorrência', price: 100 })
        .expect(201);

      const newProdId = prodRes.body.id;

      // 2. Adicionar exatamente 10 unidades de estoque
      await request(app.getHttpServer())
        .post('/inventory/replenish')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ productId: newProdId, quantity: 10 })
        .expect(201);

      // 3. Criar dois pedidos separados: um solicitando 8 e outro solicitando 7 (total 15 > 10)
      const order1Res = await request(app.getHttpServer())
        .post('/orders')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .send({ items: [{ productId: newProdId, quantity: 8 }] })
        .expect(201);

      const order1Id = order1Res.body.id;

      const order2Res = await request(app.getHttpServer())
        .post('/orders')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .send({ items: [{ productId: newProdId, quantity: 7 }] })
        .expect(201);

      const order2Id = order2Res.body.id;

      // Aprovar ambos os pedidos como Vendedor
      await request(app.getHttpServer())
        .post(`/orders/${order1Id}/approve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/orders/${order2Id}/approve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(201);

      // 4. Executar ambas as reservas concorrentemente pelo pessoal de estoque com Promise.all
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post(`/orders/${order1Id}/reserve`)
          .set('x-user-id', managerId)
          .set('x-user-role', 'InventoryManager'),
        request(app.getHttpServer())
          .post(`/orders/${order2Id}/reserve`)
          .set('x-user-id', managerId)
          .set('x-user-role', 'InventoryManager'),
      ]);

      const statusCodes = responses.map((r: any) => r.status);
      expect(statusCodes).toContain(201);
      expect(statusCodes).toContain(409); // Conflito de estoque insuficiente

      // 5. Verificar que o estoque final nunca ficou negativo (ficou 2 ou 3)
      const stockRes = await request(app.getHttpServer())
        .get(`/products/${newProdId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);

      expect(stockRes.body.availableQuantity).toBeGreaterThanOrEqual(2);
      expect(stockRes.body.availableQuantity).toBeLessThanOrEqual(3);
    });
  });

  describe('Fluxo D: Regra 3 - Cancelamento de Pedido Reservado Libera Integralmente o Estoque', () => {
    it('deve restaurar 100% do saldo ao cancelar um pedido no status RESERVED', async () => {
      // 1. Criar novo produto com 15 unidades
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ name: 'Produto Teste Cancelamento', price: 50 })
        .expect(201);
      const prodId = prodRes.body.id;

      await request(app.getHttpServer())
        .post('/inventory/replenish')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ productId: prodId, quantity: 15 })
        .expect(201);

      // 2. Criar e reservar pedido com 10 unidades
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .send({ items: [{ productId: prodId, quantity: 10 }] })
        .expect(201);
      const orderIdToCancel = orderRes.body.id;

      await request(app.getHttpServer())
        .post(`/orders/${orderIdToCancel}/approve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/orders/${orderIdToCancel}/reserve`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(201);

      // Saldo deve ter caído para 5 (15 - 10)
      const stockMid = await request(app.getHttpServer())
        .get(`/products/${prodId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);
      expect(stockMid.body.availableQuantity).toBe(5);

      // 3. Cancelar o pedido
      await request(app.getHttpServer())
        .post(`/orders/${orderIdToCancel}/cancel`)
        .set('x-user-id', client1Id)
        .set('x-user-role', 'Client')
        .expect(201);

      // 4. Saldo deve retornar integralmente para 15
      const stockFinal = await request(app.getHttpServer())
        .get(`/products/${prodId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);
      expect(stockFinal.body.availableQuantity).toBe(15);
    });
  });

  describe('Fluxo E: Regra 4 - Alteração de Itens e Ajuste de Reserva', () => {
    it('deve ajustar o estoque proporcionalmente ao alterar quantidade em pedido já reservado por Vendedor/Admin', async () => {
      // 1. Criar novo produto com 20 unidades
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ name: 'Produto Teste Delta Reserva', price: 80 })
        .expect(201);
      const prodId = prodRes.body.id;

      await request(app.getHttpServer())
        .post('/inventory/replenish')
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .send({ productId: prodId, quantity: 20 })
        .expect(201);

      // 2. Criar pedido com 10 unidades e reservar
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .send({ customerId: client1Id, items: [{ productId: prodId, quantity: 10 }] })
        .expect(201);
      const oId = orderRes.body.id;

      await request(app.getHttpServer())
        .post(`/orders/${oId}/approve`)
        .set('x-user-id', sellerId)
        .set('x-user-role', 'Seller')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/orders/${oId}/reserve`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(201);

      // Saldo atual: 10
      const stock1 = await request(app.getHttpServer())
        .get(`/products/${prodId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);
      expect(stock1.body.availableQuantity).toBe(10);

      // 3. Super Admin altera quantidade de 10 para 14 (+4 unidades adicionais)
      await request(app.getHttpServer())
        .put(`/orders/${oId}/items`)
        .set('x-user-id', adminId)
        .set('x-user-role', 'Admin')
        .send({ items: [{ productId: prodId, quantity: 14 }] })
        .expect(200);

      // Saldo deve ter caído de 10 para 6 (20 - 14 = 6)
      const stock2 = await request(app.getHttpServer())
        .get(`/products/${prodId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);
      expect(stock2.body.availableQuantity).toBe(6);

      // 4. Super Admin reduz quantidade de 14 para 5 (devolve 9 unidades)
      await request(app.getHttpServer())
        .put(`/orders/${oId}/items`)
        .set('x-user-id', adminId)
        .set('x-user-role', 'Admin')
        .send({ items: [{ productId: prodId, quantity: 5 }] })
        .expect(200);

      // Saldo deve ter subido de 6 para 15 (20 - 5 = 15)
      const stock3 = await request(app.getHttpServer())
        .get(`/products/${prodId}/stock`)
        .set('x-user-id', managerId)
        .set('x-user-role', 'InventoryManager')
        .expect(200);
      expect(stock3.body.availableQuantity).toBe(15);
    });
  });
});
