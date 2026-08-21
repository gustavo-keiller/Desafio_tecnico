"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, authFetch } from '../../auth';
import { 
  PlusIcon, 
  StarIcon, 
  AlertTriangleIcon, 
  ZapIcon 
} from '../../icons';

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [customerId, setCustomerId] = useState('');
  const [fulfillmentStrategy, setFulfillmentStrategy] = useState<'ALL' | 'PARTIAL'>('ALL');
  const [items, setItems] = useState<{productId: string, quantity: number | ''}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    authFetch('/products', {}, user).then(res => res.json()).then(setProducts).catch(() => {});
    
    if (user.role === 'Admin' || user.role === 'Seller') {
      authFetch('/customers', {}, user).then(res => res.json()).then(setCustomers).catch(() => {});
    }
  }, [user]);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((user?.role === 'Admin' || user?.role === 'Seller') && !customerId) return setError('Por favor, selecione um cliente.');
    if (items.length === 0) return setError('Por favor, adicione pelo menos um item.');
    if (items.some(i => !i.productId || !i.quantity || Number(i.quantity) < 1)) {
      return setError('Por favor, preencha todos os campos com quantidades válidas (mínimo 1).');
    }

    setLoading(true);
    setError('');

    try {
      const sanitizedItems = items.map(i => ({
        productId: i.productId,
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      }));

      const payload: any = {
        items: sanitizedItems,
        fulfillmentStrategy,
      };
      if (user?.role === 'Admin' || user?.role === 'Seller') {
        payload.customerId = customerId;
      }

      const res = await authFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao criar pedido');
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="title" style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Criar Novo Pedido</h1>
      
      {error && <div style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {(user?.role === 'Admin' || user?.role === 'Seller') && (
          <div className="form-group mb-4">
            <label className="form-label">Cliente</label>
            <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">Selecione um cliente...</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>
        )}
        {/* VIP Customer Benefits Notice */}
        {(() => {
          const selectedCustomer = customers.find(c => c.id === customerId);
          const isTargetVip = user?.role === 'Client' ? Boolean(user?.isVip) : Boolean(selectedCustomer?.isVip);
          if (!isTargetVip) return null;

          return (
            <div 
              className="p-3 mb-4 rounded" 
              style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', border: '1px solid #fde68a', color: '#92400e' }}
            >
              <div className="flex items-center gap-3">
                <div style={{ background: '#FEF3C7', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StarIcon size={18} color="#D97706" />
                </div>
                <div>
                  <strong>Cliente VIP com Benefícios Comerciais Ativos</strong>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    Este pedido conta com <strong>10% de desconto comercial automático</strong> e prioridade máxima na fila de concorrência.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="form-group mb-4">
          <label className="form-label">Estratégia de Atendimento do Estoque</label>
          <select 
            className="form-control" 
            value={fulfillmentStrategy} 
            onChange={e => setFulfillmentStrategy(e.target.value as 'ALL' | 'PARTIAL')}
          >
            <option value="ALL">Atendimento Total (Tudo ou Nada)</option>
            <option value="PARTIAL">Atendimento Parcial (Reservar o que houver)</option>
          </select>
        </div>

        <div className="form-group mt-4">
          <div className="flex justify-between items-center mb-4">
            <label className="form-label" style={{ margin: 0 }}>Itens do Pedido</label>
            <button type="button" className="btn btn-outline" onClick={addItem}>
              <PlusIcon size={14} /> Adicionar Item
            </button>
          </div>

          {items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum item adicionado ainda.</p>}

          <div className="grid gap-4">
            {items.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.productId);
              const avail = selectedProduct?.stock?.availableQuantity || 0;
              const requestedQty = Number(item.quantity) || 0;
              const isExceedingStock = selectedProduct && requestedQty > avail;
              const lineSubtotal = selectedProduct ? Number(selectedProduct.price) * requestedQty : 0;

              return (
                <div key={index} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: '10px' }}>
                  <div className="flex gap-4 items-center">
                    <div style={{ flex: 1 }}>
                      <select 
                        className="form-control" 
                        value={item.productId} 
                        onChange={e => updateItem(index, 'productId', e.target.value)}
                        required
                      >
                        <option value="">Selecione um produto...</option>
                        {products.map((p: any) => {
                          const pAvail = p.stock?.availableQuantity || 0;
                          const isOutOfStock = pAvail === 0;
                          return (
                            <option 
                              key={p.id} 
                              value={p.id}
                            >
                              {p.name} - R$ {Number(p.price).toFixed(2)} (Estoque: {pAvail}){isOutOfStock ? ' [Sem Estoque]' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div style={{ width: '90px' }}>
                      <input 
                        type="number" 
                        className="form-control" 
                        min="1" 
                        value={item.quantity} 
                        onChange={e => {
                          const val = e.target.value;
                          updateItem(index, 'quantity', val === '' ? '' : parseInt(val, 10));
                        }}
                        onBlur={() => {
                          if (item.quantity === '' || Number(item.quantity) < 1) {
                            updateItem(index, 'quantity', 1);
                          }
                        }}
                        required 
                      />
                    </div>
                    <div style={{ width: '120px', textAlign: 'right', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Subtotal:</span><br />
                      <span style={{ color: '#0F172A', fontWeight: 700 }}>R$ {lineSubtotal.toFixed(2)}</span>
                    </div>
                    <button type="button" className="btn btn-danger" onClick={() => removeItem(index)}>Remover</button>
                  </div>

                  {/* Real-time stock warning assistant */}
                  {isExceedingStock && (
                    <div 
                      style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.5rem 0.75rem', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem',
                        background: fulfillmentStrategy === 'ALL' ? '#FEF3C7' : '#E0F2FE',
                        color: fulfillmentStrategy === 'ALL' ? '#92400E' : '#0369A1',
                        border: `1px solid ${fulfillmentStrategy === 'ALL' ? '#FDE68A' : '#BAE6FD'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {fulfillmentStrategy === 'ALL' ? (
                        <>
                          <AlertTriangleIcon size={16} color="#D97706" />
                          <span><strong>Atenção:</strong> A quantidade solicitada ({requestedQty}) excede o saldo disponível ({avail}). Como a estratégia é <em>Atendimento Total</em>, o pedido exigirá reposição antes de iniciar a separação.</span>
                        </>
                      ) : (
                        <>
                          <ZapIcon size={16} color="#0369A1" />
                          <span><strong>Atendimento Parcial:</strong> Serão separadas as <strong>{avail}</strong> unidades disponíveis em estoque e o saldo restante será ajustado na separação.</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimated Grand Total Summary */}
        {items.length > 0 && (() => {
          const selectedCustomer = customers.find(c => c.id === customerId);
          const isTargetVip = user?.role === 'Client' ? Boolean(user?.isVip) : Boolean(selectedCustomer?.isVip);
          
          const rawSubtotal = items.reduce((sum, item) => {
            const p = products.find(prod => prod.id === item.productId);
            return sum + (p ? Number(p.price) * (Number(item.quantity) || 0) : 0);
          }, 0);

          const vipDiscount = isTargetVip ? rawSubtotal * 0.10 : 0;
          const finalEstimatedTotal = rawSubtotal - vipDiscount;

          return (
            <div className="mt-4 p-4 rounded" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Itens Selecionados:</span>
                <strong>{items.filter(i => Boolean(i.productId)).length} produto(s)</strong>
              </div>

              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Subtotal dos Produtos:</span>
                <span style={{ fontWeight: 600 }}>R$ {rawSubtotal.toFixed(2)}</span>
              </div>

              {isTargetVip && (
                <div className="flex justify-between items-center mb-1" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <StarIcon size={13} color="#10B981" /> Desconto VIP (10%):
                  </span>
                  <strong style={{ color: 'var(--success)' }}>- R$ {vipDiscount.toFixed(2)}</strong>
                </div>
              )}

              <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '2px dashed #CBD5E1' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>Total Final Estimado:</span>
                <span className="title" style={{ fontSize: '1.5rem', color: isTargetVip ? 'var(--success)' : 'var(--primary)', margin: 0 }}>
                  R$ {finalEstimatedTotal.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="mt-4" style={{ textAlign: 'right' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}
