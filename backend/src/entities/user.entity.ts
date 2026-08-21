import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Role } from '../auth/roles/roles.decorator';

export { Role as UserRole };

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({
    type: 'nvarchar',
    enum: Role,
    default: Role.CLIENT,
  })
  role: Role;

  @Column({ default: false })
  isVip: boolean;

  @Column({ type: 'simple-json', nullable: true })
  customPermissions: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
