import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { User } from './entities/user.entity';
import { RolePermission } from './entities/role-permission.entity';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PermissionsModule } from './auth/permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = process.env.NODE_ENV === 'test' || process.env.DB_TYPE === 'sqlite';
        const dbType = isTest ? 'sqlite' : (configService.get<string>('DB_TYPE') || 'mssql');
        console.log(`[Database Factory] NODE_ENV=${process.env.NODE_ENV}, DB_TYPE=${process.env.DB_TYPE} -> selected: ${dbType}`);
        const entities = [
          Customer,
          Product,
          Stock,
          Order,
          OrderItem,
          StockReservation,
          StockMovement,
          User,
          RolePermission,
        ];

        if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
          return {
            type: 'better-sqlite3',
            database: ':memory:',
            entities,
            synchronize: true,
            dropSchema: true,
          };
        }

        return {
          type: 'mssql',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: parseInt(configService.get<string>('DB_PORT', '1433'), 10),
          username: configService.get<string>('DB_USER', 'sa'),
          password: configService.get<string>('DB_PASS', 'YourStrong!Passw0rd'),
          database: configService.get<string>('DB_NAME', 'master'),
          entities,
          synchronize: true,
          options: {
            encrypt: true,
            trustServerCertificate: true,
          },
        };
      },
    }),
    OrdersModule,
    ProductsModule,
    CustomersModule,
    AuthModule,
    UsersModule,
    PermissionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
