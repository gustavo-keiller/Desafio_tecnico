import { SetMetadata } from '@nestjs/common';

export enum Role {
  CLIENT = 'Client',
  SELLER = 'Seller',
  INVENTORY_MANAGER = 'InventoryManager',
  ADMIN = 'Admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
