import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from '../../entities/role-permission.entity';
import { Permission, PERMISSIONS_CATALOG, PermissionDefinition } from './permissions.enum';
import { Role } from '../roles/roles.decorator';

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission), // Super Admin starts with ALL 14 permissions active
  [Role.SELLER]: [
    Permission.ORDERS_READ_ALL,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_APPROVE,
    Permission.ORDERS_CANCEL,
    Permission.PRODUCTS_READ,
    Permission.CUSTOMERS_READ,
  ],
  [Role.CLIENT]: [
    Permission.ORDERS_READ_OWN,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_UPDATE_ITEMS,
    Permission.ORDERS_CANCEL,
    Permission.PRODUCTS_READ,
  ],
  [Role.INVENTORY_MANAGER]: [
    Permission.ORDERS_READ_ALL,
    Permission.ORDERS_RESERVE,
    Permission.ORDERS_CONFIRM,
    Permission.PRODUCTS_READ,
    Permission.PRODUCTS_CREATE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_REPLENISH,
  ],
};

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  getCatalog(): PermissionDefinition[] {
    return PERMISSIONS_CATALOG;
  }

  async getAllRolePermissions(): Promise<Record<string, string[]>> {
    const dbRecords = await this.rolePermissionRepo.find();
    const result: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };

    for (const record of dbRecords) {
      result[record.role] = record.permissions || [];
    }

    // Always ensure Admin has ALL permissions active
    result[Role.ADMIN] = Object.values(Permission);

    return result;
  }

  async getPermissionsForRole(role: string): Promise<string[]> {
    if (role === Role.ADMIN) {
      return Object.values(Permission);
    }

    const record = await this.rolePermissionRepo.findOneBy({ role });
    if (record && record.permissions) {
      return record.permissions;
    }

    return DEFAULT_ROLE_PERMISSIONS[role as Role] || [];
  }

  async getEffectivePermissionsForUser(user: { role: string; customPermissions?: string[] | null }): Promise<string[]> {
    if (user.role === Role.ADMIN) {
      return Object.values(Permission);
    }

    const rolePermissions = await this.getPermissionsForRole(user.role);

    if (!user.customPermissions) {
      return rolePermissions;
    }

    // Intersect user custom permissions with active role permissions (user can have all or FEWER than role)
    return user.customPermissions.filter(p => rolePermissions.includes(p));
  }

  async updateRolePermissions(role: string, permissions: string[]): Promise<RolePermission> {
    // If updating Admin, force ALL permissions
    let finalPermissions = permissions;
    if (role === Role.ADMIN) {
      finalPermissions = Object.values(Permission);
    }

    let record = await this.rolePermissionRepo.findOneBy({ role });
    if (!record) {
      record = this.rolePermissionRepo.create({ role, permissions: finalPermissions });
    } else {
      record.permissions = finalPermissions;
    }

    return this.rolePermissionRepo.save(record);
  }
}
