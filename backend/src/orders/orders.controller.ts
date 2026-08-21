import {
  Controller,
  Post,
  Body,
  Param,
  Put,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrderQueueService, QueuePriority } from './order-queue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemsDto } from './dto/update-order.dto';
import { RolesGuard } from '../auth/roles/roles.guard';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { PermissionsService } from '../auth/permissions/permissions.service';
import { UsersService } from '../users/users.service';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderQueueService: OrderQueueService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('queue/metrics')
  @RequirePermissions(Permission.USERS_MANAGE)
  getQueueMetrics() {
    return this.orderQueueService.getMetrics();
  }

  @Get('stats')
  @RequirePermissions(Permission.ORDERS_READ_ALL, Permission.ORDERS_READ_OWN)
  async getStats(@Request() req: any) {
    const userPerms = await this.permissionsService.getEffectivePermissionsForUser(req.user);
    if (!userPerms.includes(Permission.ORDERS_READ_ALL)) {
      return this.ordersService.getStats(req.user.id);
    }
    return this.ordersService.getStats(undefined);
  }

  @Post()
  @RequirePermissions(Permission.ORDERS_CREATE)
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req: any) {
    // If user has only own-orders permission or no customerId passed, bind to self
    if (req.user.role === 'Client' || !createOrderDto.customerId) {
      createOrderDto.customerId = req.user.id;
    }

    // Determine priority based on VIP customer status
    const targetUserId = createOrderDto.customerId;
    const targetUser = await this.usersService.findById(targetUserId);
    const priority = targetUser?.isVip ? QueuePriority.VIP_CLIENT : QueuePriority.STANDARD;

    return this.orderQueueService.enqueue(
      priority,
      () => this.ordersService.createOrder(createOrderDto),
      `Criar Pedido (${targetUser?.isVip ? 'VIP' : 'Padrão'})`,
    );
  }

  @Get()
  @RequirePermissions(Permission.ORDERS_READ_ALL, Permission.ORDERS_READ_OWN)
  async findAll(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 10;

    const userPerms = await this.permissionsService.getEffectivePermissionsForUser(req.user);
    if (!userPerms.includes(Permission.ORDERS_READ_ALL)) {
      // User can only view their own orders
      return this.ordersService.findAll(req.user.id, p, l, status, search);
    }
    return this.ordersService.findAll(undefined, p, l, status, search);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDERS_READ_ALL, Permission.ORDERS_READ_OWN)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const order = await this.ordersService.findOne(id);
    if (!order) return null;

    const userPerms = await this.permissionsService.getEffectivePermissionsForUser(req.user);
    if (!userPerms.includes(Permission.ORDERS_READ_ALL) && order.customerId !== req.user.id) {
      throw new ForbiddenException('Você só pode acessar seus próprios pedidos.');
    }
    return order;
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.ORDERS_APPROVE)
  approve(@Param('id') id: string) {
    return this.orderQueueService.enqueue(
      QueuePriority.STANDARD,
      () => this.ordersService.approveOrder(id),
      `Aprovar Pedido ${id.slice(0, 8)}`,
    );
  }

  @Post(':id/reserve')
  @RequirePermissions(Permission.ORDERS_RESERVE)
  reserve(@Param('id') id: string) {
    return this.orderQueueService.enqueue(
      QueuePriority.STANDARD,
      () => this.ordersService.reserveOrder(id),
      `Iniciar Separação ${id.slice(0, 8)}`,
    );
  }

  @Post(':id/confirm')
  @RequirePermissions(Permission.ORDERS_CONFIRM)
  confirm(@Param('id') id: string) {
    return this.orderQueueService.enqueue(
      QueuePriority.STANDARD,
      () => this.ordersService.confirmOrder(id),
      `Concluir Separação ${id.slice(0, 8)}`,
    );
  }

  @Put(':id/items')
  @RequirePermissions(Permission.ORDERS_UPDATE_ITEMS)
  async updateItems(
    @Param('id') id: string,
    @Body() updateOrderItemsDto: UpdateOrderItemsDto,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    const userPerms = await this.permissionsService.getEffectivePermissionsForUser(req.user);
    if (!userPerms.includes(Permission.ORDERS_READ_ALL) && order?.customerId !== req.user.id) {
      throw new ForbiddenException('Você só pode atualizar seus próprios pedidos.');
    }

    if (req.user.role === 'Client' && order?.status !== 'ORDERED') {
      throw new ForbiddenException(
        'Você só pode alterar pedidos que ainda estejam no status Criado (antes da aprovação/separação).',
      );
    }

    return this.orderQueueService.enqueue(
      QueuePriority.STANDARD,
      () => this.ordersService.updateOrderItems(id, updateOrderItemsDto),
      `Editar Itens ${id.slice(0, 8)}`,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.ORDERS_CANCEL)
  async cancel(@Param('id') id: string, @Request() req: any) {
    const order = await this.ordersService.findOne(id);
    const userPerms = await this.permissionsService.getEffectivePermissionsForUser(req.user);
    if (!userPerms.includes(Permission.ORDERS_READ_ALL) && order?.customerId !== req.user.id) {
      throw new ForbiddenException('Você só pode cancelar seus próprios pedidos.');
    }
    return this.orderQueueService.enqueue(
      QueuePriority.CANCEL,
      () => this.ordersService.cancelOrder(id),
      `Cancelar Pedido ${id.slice(0, 8)}`,
    );
  }
}

