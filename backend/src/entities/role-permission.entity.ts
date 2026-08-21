import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ type: 'nvarchar', length: 50 })
  role: string;

  @Column({ type: 'simple-json' })
  permissions: string[];
}
