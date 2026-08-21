"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth';
import { 
  PackageIcon, 
  PlusIcon, 
  FileTextIcon, 
  RefreshIcon, 
  TagIcon, 
  ShieldIcon 
} from './icons';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Super Admin',
  Seller: 'Vendedor',
  Client: 'Cliente',
  InventoryManager: 'Gerente de Estoque',
};

export default function Navbar() {
  const { user, setUser, mockUsers } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}>
      {/* Subtle Top Accent Gradient Line */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #2563EB 0%, #0EA5E9 50%, #6366F1 100%)' }} />
      
      <div className="container" style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Brand Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
          }}>
            <PackageIcon size={20} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A' }}>
              ERP<span style={{ color: '#2563EB' }}> Polirex</span>
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748B', fontWeight: 500, marginTop: '-3px' }}>
              Gestão de Pedidos & Estoque
            </span>
          </div>
        </Link>
        
        {/* Navigation Links */}
        <div className="flex gap-2 items-center">
          <Link 
            href="/" 
            className={`btn ${isActive('/') ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
          >
            <FileTextIcon size={15} />
            Pedidos
          </Link>
          
          {['Client', 'Seller', 'Admin'].includes(user?.role || '') && (
            <Link 
              href="/orders/new" 
              className={`btn ${isActive('/orders/new') ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
            >
              <PlusIcon size={15} />
              Novo Pedido
            </Link>
          )}

          {['InventoryManager', 'Admin'].includes(user?.role || '') && (
            <Link 
              href="/inventory" 
              className={`btn ${isActive('/inventory') ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
            >
              <RefreshIcon size={15} />
              Reposição
            </Link>
          )}

          <Link 
            href="/products" 
            className={`btn ${isActive('/products') ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
          >
            <TagIcon size={15} />
            Produtos
          </Link>

          {user?.role === 'Admin' && (
            <Link 
              href="/admin/usuarios" 
              className={`btn ${isActive('/admin/usuarios') ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                fontSize: '0.8125rem', 
                padding: '0.45rem 0.85rem',
                borderColor: isActive('/admin/usuarios') ? undefined : '#93C5FD',
                color: isActive('/admin/usuarios') ? undefined : '#2563EB'
              }}
            >
              <ShieldIcon size={15} />
              Usuários & Permissões
            </Link>
          )}

          {/* User Persona Switcher */}
          <div style={{ marginLeft: '0.75rem', paddingLeft: '0.75rem', borderLeft: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Perfil:</span>
            <select 
              className="form-control"
              style={{ 
                width: 'auto', 
                padding: '0.4rem 0.6rem', 
                fontSize: '0.8125rem', 
                fontWeight: 600,
                background: '#F8FAFC',
                borderColor: '#CBD5E1',
                borderRadius: '8px'
              }}
              value={user?.id || ''}
              onChange={e => {
                const u = mockUsers.find(x => x.id === e.target.value);
                if (u) setUser(u);
              }}
            >
              {mockUsers.map(u => {
                const roleText = ROLE_LABELS[u.role] || u.role;
                const hasRoleInName = u.name.includes('(');
                const displayLabel = hasRoleInName 
                  ? u.name 
                  : `${u.name} (${roleText}${u.isVip ? ' VIP' : ''})`;
                return (
                  <option key={u.id} value={u.id}>{displayLabel}</option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
