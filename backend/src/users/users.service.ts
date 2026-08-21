import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Customer } from '../entities/customer.entity';
import { Order } from '../entities/order.entity';

export class CreateUserDto {
  name: string;
  email: string;
  role: UserRole;
  isVip?: boolean;
  customPermissions?: string[] | null;
}

export class UpdateUserDto {
  name?: string;
  email?: string;
  role?: UserRole;
  isVip?: boolean;
  customPermissions?: string[] | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Customer) private customerRepository: Repository<Customer>,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOneBy({ email: dto.email });
    if (existing) throw new ConflictException('Já existe um usuário com este e-mail');
    
    const user = this.userRepository.create({
      ...dto,
      isVip: Boolean(dto.isVip),
    });
    const savedUser = await this.userRepository.save(user);

    // If user is a Client, ensure customer entity exists with matching id
    if (savedUser.role === UserRole.CLIENT) {
      await this.customerRepository.save({
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        isVip: savedUser.isVip,
      });
    }

    return savedUser;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOneBy({ email: dto.email });
      if (existing) throw new ConflictException('Já existe um usuário com este e-mail');
    }
    Object.assign(user, dto);
    const savedUser = await this.userRepository.save(user);

    // If user is/became a Client, sync customer record
    if (savedUser.role === UserRole.CLIENT) {
      await this.customerRepository.save({
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        isVip: savedUser.isVip,
      });
    }

    return savedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    // Check if user has orders before deleting
    const existingOrders = await this.orderRepository.count({ where: { customerId: id } });
    if (existingOrders > 0) {
      throw new ConflictException(
        `Este usuário possui ${existingOrders} pedido(s) vinculado(s) e não pode ser excluído do sistema.`,
      );
    }

    // If customer record exists and has no orders, remove it too
    const customer = await this.customerRepository.findOneBy({ id });
    if (customer) {
      await this.customerRepository.remove(customer);
    }

    await this.userRepository.remove(user);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async setVipStatus(id: string, isVip: boolean): Promise<User> {
    const user = await this.findOne(id);
    user.isVip = Boolean(isVip);
    const savedUser = await this.userRepository.save(user);

    const customer = await this.customerRepository.findOneBy({ id });
    if (customer) {
      customer.isVip = savedUser.isVip;
      await this.customerRepository.save(customer);
    }
    return savedUser;
  }
}
