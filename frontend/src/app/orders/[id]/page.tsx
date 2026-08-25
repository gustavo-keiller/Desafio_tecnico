"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, authFetch } from '../../auth';
import { 
  StarIcon, 
  ZapIcon, 
  LockIcon, 
  LayersIcon, 
  CheckCircleIcon 
} from '../../icons';

const STATUS_LABELS: Record<string, string> = {
  ORDERED: 'Criado',
  APPROVED: 'Aprovado',
  RESERVED: 'Em Separação',
  FINISHED: 'Concluído',
  ERROR: 'Erro',
  CANCELED: 'Cancelado',
  CANCELADO: 'Cancelado',
};

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;
  
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<{productId: string; quantity: number | ''; unitPrice: number; name: string}[]>([]);

  const fetchOrder = async () => {
    if (!user) return;
    try {
      const res = await authFetch(`/orders/${orderId}`, {}, user);
      if (!res.ok) throw new Error('Falha ao buscar pedido');
      const data = await res.json();
      setOrder(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId, user]);

  const handleAction = async (action: 'approve' | 'reserve' | 'confirm' | 'cancel') => {
    if (!user) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await authFetch(`/orders/${orderId}/${action}`, {
        method: 'POST',
      }, user);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `Falha ao executar ${action} no pedido`);
      }
      await fetchOrder(); // refresh data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = () => {
    setEditItems(order.items.map((i: any) => ({
      productId: i.productId,
      name: i.product?.name || i.productId,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice)
    })));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  const saveEdit = async () => {
    if (!user) return;
    if (editItems.some(i => !i.quantity || Number(i.quantity) < 1)) {
      return setError('Por favor, informe quantidades válidas para todos os itens.');
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await authFetch(`/orders/${orderId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.map(i => ({
            productId: i.productId,
            quantity: Math.max(1, Math.floor(Number(i.quantity) || 1))
          }))
        }),
      }, user);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao atualizar itens');
      }
      setIsEditing(false);
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const updateEditQty = (productId: string, val: any) => {
    setEditItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: val } : i));
  };

  if (loading) return <div>Carregando detalhes do pedido...</div>;
  if (!order) return <div style={{ color: 'var(--danger)' }}>{error || 'Pedido não encontrado'}</div>;

  const isClient = user?.role === 'Client';
  const isStaff = user?.role === 'Admin' || user?.role === 'Seller';
  const canEdit = (order.status === 'ORDERED' && isClient) ||
    (['ORDERED', 'APPROVED', 'RESERVED'].includes(order.status) && isStaff);

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>Detalhes do Pedido</h1>
        <Link href="/" className="btn btn-outline">Voltar para Pedidos</Link>
      </div>

      {error && <div style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      <div className="grid grid-cols-2 gap-4 mb-4" style={{ background: '#F8FAFC', padding: '1.5rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID do Pedido</p>
          <p style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1E293B', background: '#FFFFFF', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'inline-block' }}>
            {order.id}
          </p>
        </div>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status Transacional</p>
          <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>
        </div>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</p>
          <p style={{ fontWeight: 600, color: '#0F172A' }}>
            {order.customer?.name} <span style={{ color: '#64748B', fontWeight: 400 }}>({order.customer?.email})</span>
            {order.customer?.isVip && (
              <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                <StarIcon size={12} color="#D97706" /> VIP
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estratégia de Atendimento</p>
          <span className="badge" style={{ background: order.fulfillmentStrategy === 'PARTIAL' ? '#E0F2FE' : '#F1F5F9', color: '#0369A1', borderColor: '#BAE6FD' }}>
            {order.fulfillmentStrategy === 'PARTIAL' ? (
              <><ZapIcon size={12} color="#0369A1" /> Atendimento Parcial</>
            ) : (
              <><LockIcon size={12} color="#475569" /> Atendimento Total (Tudo ou Nada)</>
            )}
          </span>
        </div>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Total</p>
          <p className="title" style={{ fontSize: '1.35rem', color: Number(order.discountValue) > 0 ? 'var(--success)' : 'var(--primary)', margin: 0 }}>
            R$ {Number(order.totalValue).toFixed(2)}
          </p>
          {Number(order.discountValue) > 0 && (
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <StarIcon size={12} color="#10B981" /> Inclui R$ {Number(order.discountValue).toFixed(2)} de Desconto VIP (10%)
            </p>
          )}
        </div>
        <div>
          <p className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data de Criação</p>
          <p style={{ color: '#334155' }}>{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 style={{ margin: 0 }}>Itens do Pedido</h3>
          {!canEdit && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              {order.status === 'FINISHED' 
                ? 'Pedido concluído. Itens finalizados.'
                : (order.status === 'CANCELED')
                ? 'Pedido cancelado.'
                : isClient
                ? 'Itens bloqueados para edição direta pelo cliente após a aprovação comercial.'
                : 'Itens bloqueados para edição.'}
            </p>
          )}
        </div>
        {canEdit && !isEditing && (
          <button className="btn btn-outline" onClick={startEdit}>
            Editar Itens {order.status === 'RESERVED' && '(Ajusta Reserva)'}
          </button>
        )}
      </div>

      <div className="table-container mb-4">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço Unitário</th>
              <th>Quantidade</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {!isEditing ? (
              order.items?.map((item: any) => (
                <tr key={item.id}>
                  <td>{item.product?.name || item.productId}</td>
                  <td>R$ {Number(item.unitPrice).toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>R$ {(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                </tr>
              ))
            ) : (
              editItems.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>R$ {item.unitPrice.toFixed(2)}</td>
                  <td>
                    <input 
                      type="number" 
                      min="1" 
                      className="form-control" 
                      style={{ width: '80px', padding: '4px' }}
                      value={item.quantity} 
                      onChange={e => {
                        const val = e.target.value;
                        updateEditQty(item.productId, val === '' ? '' : parseInt(val, 10));
                      }}
                      onBlur={() => {
                        if (item.quantity === '' || Number(item.quantity) < 1) {
                          updateEditQty(item.productId, 1);
                        }
                      }}
                    />
                  </td>
                  <td>R$ {(item.unitPrice * (Number(item.quantity) || 0)).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="flex gap-4 mt-4 mb-4">
          <button className="btn btn-primary" onClick={saveEdit} disabled={actionLoading}>
            {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button className="btn btn-outline" onClick={cancelEdit} disabled={actionLoading}>
            Cancelar
          </button>
        </div>
      )}

      <div className="flex gap-4 mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        {order.status === 'ORDERED' && ['Seller', 'Admin'].includes(user?.role || '') && !isEditing && (
          <button 
            className="btn btn-success" 
            onClick={() => handleAction('approve')}
            disabled={actionLoading}
          >
            <CheckCircleIcon size={15} color="#FFFFFF" />
            {actionLoading ? 'Processando...' : 'Aprovar Pedido'}
          </button>
        )}

        {order.status === 'APPROVED' && ['InventoryManager', 'Admin'].includes(user?.role || '') && !isEditing && (
          <button 
            className="btn btn-primary" 
            onClick={() => handleAction('reserve')}
            disabled={actionLoading}
          >
            <LayersIcon size={15} color="#FFFFFF" />
            {actionLoading ? 'Processando...' : 'Iniciar Separação'}
          </button>
        )}
        
        {order.status === 'RESERVED' && ['InventoryManager', 'Admin'].includes(user?.role || '') && !isEditing && (
          <button 
            className="btn btn-success" 
            onClick={() => handleAction('confirm')}
            disabled={actionLoading}
          >
            <CheckCircleIcon size={15} color="#FFFFFF" />
            {actionLoading ? 'Processando...' : 'Finalizar Separação'}
          </button>
        )}

        {['ORDERED', 'APPROVED', 'RESERVED', 'ERROR'].includes(order.status) && ['Client', 'Admin', 'Seller'].includes(user?.role || '') && !isEditing && (
          <button 
            className="btn btn-danger" 
            onClick={() => handleAction('cancel')}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processando...' : 'Cancelar Pedido'}
          </button>
        )}
      </div>
    </div>
  );
}
