import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';
import { User, UserRole } from './entities/user.entity';
import { RolePermission } from './entities/role-permission.entity';
import { DEFAULT_ROLE_PERMISSIONS } from './auth/permissions/permissions.service';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Seeding database...');

  // Clear existing
  await dataSource.query(`DELETE FROM order_items`);
  await dataSource.query(`DELETE FROM stock_reservations`);
  await dataSource.query(`DELETE FROM stock_movements`);
  await dataSource.query(`DELETE FROM orders`);
  await dataSource.query(`DELETE FROM stocks`);
  await dataSource.query(`DELETE FROM products`);
  await dataSource.query(`DELETE FROM customers`);
  await dataSource.query(`DELETE FROM users`);
  await dataSource.query(`DELETE FROM role_permissions`);

  // Insert Role Permissions (Default Matrix)
  const rolePermissionRepo = dataSource.getRepository(RolePermission);
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await rolePermissionRepo.save({ role, permissions });
  }

  // Insert Users
  const userRepo = dataSource.getRepository(User);
  await userRepo.save([
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alice (Cliente VIP)',
      email: 'alice@example.com',
      role: UserRole.CLIENT,
      isVip: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Bob (Cliente)',
      email: 'bob@example.com',
      role: UserRole.CLIENT,
      isVip: false,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Joe (Gerente Estoque)',
      email: 'joe@example.com',
      role: UserRole.INVENTORY_MANAGER,
      isVip: false,
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Super Admin',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      isVip: false,
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Sally (Vendedor)',
      email: 'sally@example.com',
      role: UserRole.SELLER,
      isVip: false,
    },
  ]);

  // Insert Customers
  const customerRepo = dataSource.getRepository(Customer);
  const customer1 = await customerRepo.save({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alice Smith',
    email: 'alice@example.com',
    isVip: true,
  });
  const customer2 = await customerRepo.save({
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Bob Jones',
    email: 'bob@example.com',
    isVip: false,
  });

  // Insert Products and Stock
  const productRepo = dataSource.getRepository(Product);
  const stockRepo = dataSource.getRepository(Stock);

  const productA = await productRepo.save({ name: 'Produto A', price: 100.0 });
  await stockRepo.save({ productId: productA.id, availableQuantity: 10 }); // Challenge scenario requires product with 10 stock

  const productB = await productRepo.save({ name: 'Produto B', price: 50.0 });
  await stockRepo.save({ productId: productB.id, availableQuantity: 50 });

  const productC = await productRepo.save({ name: 'Produto C (Sem Estoque)', price: 150.0 });
  await stockRepo.save({ productId: productC.id, availableQuantity: 0 });

  console.log('Database seeded successfully.');
  console.log(`Test Customer 1: ${customer1.id}`);
  console.log(`Test Product A (10 stock): ${productA.id}`);

  await app.close();
}
bootstrap();
