import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from './roles/roles.guard';

@Module({
  imports: [UsersModule],
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
