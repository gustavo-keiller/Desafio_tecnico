import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from './roles.decorator';
import { PERMISSIONS_KEY } from '../permissions/permissions.decorator';
import { UsersService } from '../../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither roles nor permissions are defined, route is public
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('Header x-user-id ausente');
    }

    // Validate user exists in DB — prevents role spoofing via headers
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado no sistema');
    }

    // Attach validated user to request
    request.user = { id: user.id, role: user.role };

    // Admin has access to everything by default
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Check Roles if specified
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role as Role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Requer um dos seguintes cargos: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Check Granular Permissions if specified
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions =
        await this.permissionsService.getEffectivePermissionsForUser(user);
      const hasPermission = requiredPermissions.some((p) =>
        userPermissions.includes(p),
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          `Você não possui a permissão necessária para executar esta ação (${requiredPermissions.join(', ')})`,
        );
      }
    }

    return true;
  }
}
