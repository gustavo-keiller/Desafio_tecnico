import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService, DEFAULT_ROLE_PERMISSIONS } from './permissions.service';
import { RolePermission } from '../../entities/role-permission.entity';
import { Role } from '../roles/roles.decorator';
import { Permission, PERMISSIONS_CATALOG } from './permissions.enum';

describe('PermissionsService (Unit Tests)', () => {
  let service: PermissionsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(RolePermission),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('deve retornar o catálogo completo de permissões', () => {
    const catalog = service.getCatalog();
    expect(catalog).toEqual(PERMISSIONS_CATALOG);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('deve retornar permissões padrão para cada cargo quando o banco está vazio', async () => {
    const rolePerms = await service.getAllRolePermissions();
    expect(rolePerms[Role.ADMIN]).toEqual(Object.values(Permission));
    expect(rolePerms[Role.SELLER]).toEqual(DEFAULT_ROLE_PERMISSIONS[Role.SELLER]);
  });

  it('Super Admin deve sempre ter todas as permissões efetivas', async () => {
    const adminUser = { id: '1', role: Role.ADMIN };
    const perms = await service.getEffectivePermissionsForUser(adminUser);
    expect(perms).toEqual(Object.values(Permission));
  });

  it('deve respeitar permissões customizadas específicas de um usuário', async () => {
    const customUser = {
      id: '2',
      role: Role.CLIENT,
      customPermissions: [Permission.ORDERS_CREATE, Permission.ORDERS_READ_OWN],
    };
    const perms = await service.getEffectivePermissionsForUser(customUser);
    expect(perms).toEqual([Permission.ORDERS_CREATE, Permission.ORDERS_READ_OWN]);
  });
});
