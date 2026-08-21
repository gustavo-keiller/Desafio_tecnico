"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, authFetch } from './auth';
import { 
  PlusIcon, 
  SearchIcon, 
  StarIcon, 
  ClockIcon, 
  LayersIcon, 
  CurrencyIcon, 
  PackageIcon 
} from './icons';

const STATUS_LABELS: Record<string, string> = {
  ORDERED: 'Criado',
  APPROVED: 'Aprovado',
  RESERVED: 'Em Separação',
  FINISHED: 'Concluído',
  ERROR: 'Erro',
  CANCELADO: 'Cancelado',
};

export default function Home() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Global KPIs from backend
  const [stats, setStats] = useState({
    totalOrders: 0,
    awaitingSeparation: 0,
    inSeparation: 0,
    finishedTotalValue: 0,
  });

  const fetchStats = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/orders/stats', {}, user);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Ignore stats fetch error
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      });

      const res = await authFetch(`/orders?${query.toString()}`, {}, user);
      if (!res.ok) throw new Error('Falha ao buscar pedidos');
      const result = await res.json();

      if (result && Array.isArray(result.data)) {
        setOrders(result.data);
        setTotalOrders(result.total || 0);
        setTotalPages(result.totalPages || 1);
      } else if (Array.isArray(result)) {
        setOrders(result);
        setTotalOrders(result.length);
        setTotalPages(1);
      }
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [user, page, statusFilter, searchTerm]);

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  if (error) return <div style={{ color: 'var(--danger)', padding: '2rem' }}>{error}</div>;

  return (
    <div>
      {/* Header Banner */}
      <div className="header">
        <div>
          <h1 className="title">Painel de Pedidos & Operações</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {user?.role === 'InventoryManager' 
              ? 'Filtre por "Aprovados" para processar a fila de pedidos prontos para separação física de estoque.'
              : 'Acompanhamento transacional de pedidos, reservas de estoque e faturamento em tempo real.'}
          </p>
        </div>
        {['Client', 'Seller', 'Admin'].includes(user?.role || '') && (
          <Link href="/orders/new" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
            <PlusIcon size={16} />
            Novo Pedido
          </Link>
        )}
      </div>

      {/* Executive KPI Metric Tiles */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Metric 1 */}
        <div className="kpi-card" style={{ '--kpi-accent': '#2563EB' } as any}>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ClockIcon size={14} color="#2563EB" /> Fila de Separação
            </span>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Aprovados
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.awaitingSeparation > 0 ? '#2563EB' : '#0F172A', letterSpacing: '-0.03em' }}>
              {stats.awaitingSeparation}
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>pedidos aguardando</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="kpi-card" style={{ '--kpi-accent': '#F59E0B' } as any}>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <LayersIcon size={14} color="#D97706" /> Em Separação
            </span>
            <span style={{ background: '#FFFBEB', color: '#D97706', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Reservados
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.inSeparation > 0 ? '#D97706' : '#0F172A', letterSpacing: '-0.03em' }}>
              {stats.inSeparation}
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>em separação física</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="kpi-card" style={{ '--kpi-accent': '#10B981' } as any}>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CurrencyIcon size={14} color="#059669" /> Faturamento Concluído
            </span>
            <span style={{ background: '#ECFDF5', color: '#059669', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Finalizados
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.03em' }}>
              R$ {Number(stats.finishedTotalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="kpi-card" style={{ '--kpi-accent': '#6366F1' } as any}>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <PackageIcon size={14} color="#4F46E5" /> Total de Pedidos
            </span>
            <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Global
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>
              {stats.totalOrders}
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>registros</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="card mb-4" style={{ padding: '0.875rem 1.25rem', background: '#FFFFFF' }}>
        <div className="flex justify-between items-center gap-4" style={{ flexWrap: 'wrap' }}>
          {/* Status Filter Tabs */}
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'ORDERED', label: 'Criados' },
              { key: 'APPROVED', label: 'Aprovados (Fila)' },
              { key: 'RESERVED', label: 'Em Separação' },
              { key: 'FINISHED', label: 'Concluídos' },
              { key: 'CANCELADO', label: 'Cancelados' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${statusFilter === tab.key ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
                onClick={() => handleStatusChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Instant Search Bar */}
          <div style={{ position: 'relative', minWidth: '280px' }}>
            <input
              type="text"
              className="form-control"
              style={{ padding: '0.45rem 0.85rem 0.45rem 2.2rem', fontSize: '0.8125rem' }}
              placeholder="Buscar por cliente ou ID..."
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
            />
            <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
              <SearchIcon size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID Pedido</th>
              <th>Cliente</th>
              <th>Status Transacional</th>
              <th>Valor Total</th>
              <th>Data de Abertura</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Carregando pedidos...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  {statusFilter === 'ALL' ? 'Nenhum pedido encontrado no sistema.' : `Nenhum pedido com status "${STATUS_LABELS[statusFilter] || statusFilter}".`}
                </td>
              </tr>
            ) : (
              orders.map((order: any) => (
                <tr key={order.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155', background: '#F1F5F9', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                      #{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {order.customer?.name || 'Cliente'}
                    {order.customer?.isVip && (
                      <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', marginLeft: '0.45rem', fontSize: '0.7rem' }}>
                        <StarIcon size={11} color="#D97706" /> VIP
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: order.discountValue > 0 ? 'var(--success)' : '#0F172A' }}>
                    R$ {Number(order.totalValue).toFixed(2)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <Link 
                      href={`/orders/${order.id}`} 
                      className="btn btn-outline" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Detalhes &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <button
          className="btn btn-outline"
          disabled={page <= 1 || loading}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          &larr; Página Anterior
        </button>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalOrders} pedido{totalOrders !== 1 ? 's' : ''} no total)
        </span>
        <button
          className="btn btn-outline"
          disabled={page >= totalPages || loading}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        >
          Próxima Página &rarr;
        </button>
      </div>
    </div>
  );
}
