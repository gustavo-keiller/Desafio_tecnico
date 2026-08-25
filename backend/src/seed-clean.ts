import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User, UserRole } from './entities/user.entity';
import { RolePermission } from './entities/role-permission.entity';
import { DEFAULT_ROLE_PERMISSIONS } from './auth/permissions/permissions.service';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🧹 Limpando o banco de dados e mantendo apenas o Super Admin...');

  // Limpeza das tabelas em ordem de chave estrangeira
  await dataSource.query(`DELETE FROM order_items`);
  await dataSource.query(`DELETE FROM stock_reservations`);
  await dataSource.query(`DELETE FROM stock_movements`);
  await dataSource.query(`DELETE FROM orders`);
  await dataSource.query(`DELETE FROM stocks`);
  await dataSource.query(`DELETE FROM products`);
  await dataSource.query(`DELETE FROM customers`);
  await dataSource.query(`DELETE FROM users`);
  await dataSource.query(`DELETE FROM role_permissions`);

  // Restaura a Matriz de Permissões Padrão por Cargo
  const rolePermissionRepo = dataSource.getRepository(RolePermission);
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await rolePermissionRepo.save({ role, permissions });
  }

  // Insere UNICAMENTE o Super Admin
  const userRepo = dataSource.getRepository(User);
  const admin = await userRepo.save({
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Super Admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isVip: false,
  });

  console.log('✅ Banco de dados reiniciado com sucesso!');
  console.log(`👤 Usuário Ativo: ${admin.name} (${admin.email})`);
  console.log('📦 Produtos, Clientes e Pedidos estão 100% vazios para novos testes.');

  await app.close();
}

bootstrap();
