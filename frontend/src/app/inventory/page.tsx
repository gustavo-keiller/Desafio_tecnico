"use client";

import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../auth';
import { 
  PackageIcon, 
  FileTextIcon, 
  PlusIcon, 
  ArrowDownCircleIcon, 
  LockIcon, 
  CheckCircleIcon, 
  RefreshIcon, 
  AlertTriangleIcon 
} from '../icons';

const MOVEMENT_LABELS: Record<string, { label: string; icon: (props: any) => React.ReactNode; badgeStyle: React.CSSProperties }> = {
  IN: { 
    label: 'Entrada / Reposição', 
    icon: (props) => <ArrowDownCircleIcon size={13} color="#15803D" {...props} />,
    badgeStyle: { background: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' } 
  },
  RESERVE: { 
    label: 'Reserva de Separação', 
    icon: (props) => <LockIcon size={13} color="#B45309" {...props} />,
    badgeStyle: { background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' } 
  },
  CONSUME_RESERVE: { 
    label: 'Baixa / Conclusão', 
    icon: (props) => <CheckCircleIcon size={13} color="#0369A1" {...props} />,
    badgeStyle: { background: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD' } 
  },
  CANCEL_RESERVE: { 
    label: 'Estorno de Cancelamento', 
    icon: (props) => <RefreshIcon size={13} color="#7E22CE" {...props} />,
    badgeStyle: { background: '#F3E8FF', color: '#7E22CE', borderColor: '#E9D5FF' } 
  },
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'replenish' | 'movements'>('replenish');
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [replenishProductId, setReplenishProductId] = useState('');
  const [replenishQty, setReplenishQty] = useState<number | ''>(1);
  const [replenishLoading, setReplenishLoading] = useState(false);
  const [replenishError, setReplenishError] = useState('');

  const fetchProducts = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/products', {}, user);
      if (!res.ok) throw new Error('Falha ao buscar estoque');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    if (!user) return;
    setMovementsLoading(true);
    try {
      const res = await authFetch('/inventory/movements?page=1&limit=50', {}, user);
      if (res.ok) {
        const data = await res.json();
        setMovements(data);
      }
    } catch {
      // ignore
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    if (user && ['InventoryManager', 'Admin'].includes(user.role)) {
      fetchProducts();
      fetchMovements();
    } else {
      setError('Você não tem permissão para gerenciar o estoque.');
      setLoading(false);
    }
  }, [user]);

  const handleReplenish = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNumber = Number(replenishQty);
    if (!replenishProductId || !qtyNumber || qtyNumber < 1) {
      return setReplenishError('Informe uma quantidade válida para reposição (mínimo 1).');
    }

    setReplenishLoading(true);
    setReplenishError('');
    try {
      const res = await authFetch('/inventory/replenish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: replenishProductId, quantity: Math.max(1, Math.floor(qtyNumber)) }),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao repor estoque');
      }
      
      // Refresh lists
      setReplenishProductId('');
      setReplenishQty(1);
      await fetchProducts();
      await fetchMovements();
    } catch (err: any) {
      setReplenishError(err.message);
    } finally {
      setReplenishLoading(false);
    }
  };

  if (error) return <div style={{ color: 'var(--danger)', padding: '2rem' }}>{error}</div>;

  return (
    <div>
      <h1 className="title" style={{ marginBottom: '1.5rem' }}>Gestão e Auditoria de Estoque</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'replenish' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('replenish')}
        >
          <PackageIcon size={15} />
          Saldo Atual & Reposição
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setActiveTab('movements');
            fetchMovements();
          }}
        >
          <FileTextIcon size={15} />
          Extrato & Auditoria de Movimentações
        </button>
      </div>

      {replenishError && (
        <div style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {replenishError}
        </div>
      )}

      {/* TAB 1: REPLENISH & CURRENT BALANCES */}
      {activeTab === 'replenish' && (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Registrar Entrada de Estoque</h3>
            <form onSubmit={handleReplenish} className="flex gap-4 items-end">
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Produto</label>
                <select className="form-control" value={replenishProductId} onChange={e => setReplenishProductId(e.target.value)} required>
                  <option value="">Selecione um produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - Saldo Atual: {p.stock?.availableQuantity || 0}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ width: '150px', margin: 0 }}>
                <label className="form-label">Quantidade de Entrada</label>
                <input 
                  type="number" 
                  className="form-control" 
                  min="1" 
                  value={replenishQty} 
                  onChange={e => {
                    const val = e.target.value;
                    setReplenishQty(val === '' ? '' : parseInt(val, 10));
                  }}
                  onBlur={() => {
                    if (replenishQty === '' || Number(replenishQty) < 1) {
                      setReplenishQty(1);
                    }
                  }}
                  required 
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={replenishLoading || !replenishProductId}>
                <PlusIcon size={15} />
                {replenishLoading ? 'Adicionando...' : 'Confirmar Entrada'}
              </button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID do Produto</th>
                  <th>Nome do Produto</th>
                  <th>Preço Unitário</th>
                  <th>Estoque Disponível</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum produto cadastrado.</td></tr>
                ) : products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155', background: '#F1F5F9', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                        #{p.id.slice(0, 8)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontWeight: 700 }}>R$ {Number(p.price).toFixed(2)}</td>
                    <td>
                      <span className="badge" style={{ 
                        background: (p.stock?.availableQuantity || 0) > 0 ? '#D1FAE5' : '#FEE2E2',
                        color: (p.stock?.availableQuantity || 0) > 0 ? '#065F46' : '#991B1B',
                        borderColor: (p.stock?.availableQuantity || 0) > 0 ? '#A7F3D0' : '#FECACA',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        {(p.stock?.availableQuantity || 0) > 0 ? (
                          <><PackageIcon size={13} color="#059669" /> {p.stock?.availableQuantity} un disponíveis</>
                        ) : (
                          <><AlertTriangleIcon size={13} color="#DC2626" /> Esgotado</>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: AUDIT TRAIL / MOVEMENTS HISTORY */}
      {activeTab === 'movements' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Produto</th>
                <th>Tipo de Movimentação</th>
                <th>Quantidade</th>
                <th>Referência / Pedido</th>
              </tr>
            </thead>
            <tbody>
              {movementsLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando histórico de movimentações...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma movimentação de estoque registrada.</td></tr>
              ) : movements.map(m => {
                const conf = MOVEMENT_LABELS[m.type] || { 
                  label: m.type, 
                  icon: () => null, 
                  badgeStyle: { background: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' } 
                };
                const isPositive = m.quantity > 0;
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(m.createdAt).toLocaleString('pt-BR')}</td>
                    <td style={{ fontWeight: 600 }}>{m.product?.name || m.productId?.slice(0, 8) || 'Desconhecido'}</td>
                    <td>
                      <span className="badge" style={{ ...conf.badgeStyle, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {conf.icon({})}
                        {conf.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                      {isPositive ? `+${m.quantity}` : m.quantity} un
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#F1F5F9', padding: '0.2rem 0.45rem', borderRadius: '4px', color: '#334155' }}>
                        {m.referenceId ? `#${m.referenceId.slice(0, 8)}` : 'Entrada Manual'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
