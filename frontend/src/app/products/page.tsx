"use client";

import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../auth';
import { 
  PlusIcon, 
  SearchIcon, 
  PackageIcon, 
  AlertTriangleIcon 
} from '../icons';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchProducts = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/products', {}, user);
      if (!res.ok) throw new Error('Falha ao buscar produtos');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    setCreating(true);
    setCreateError('');
    try {
      const res = await authFetch('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: parseFloat(price) }),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao criar produto');
      }
      
      setName('');
      setPrice('');
      await fetchProducts();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      p.id.toLowerCase().includes(term) ||
      (p.name && p.name.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ margin: 0 }}>Catálogo de Produtos</h1>
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Buscar produto por nome ou ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
            <SearchIcon size={14} />
          </div>
        </div>
      </div>

      {createError && (
        <div style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {createError}
        </div>
      )}

      {['Admin', 'InventoryManager'].includes(user?.role || '') && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Cadastrar Novo Produto</h3>
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label">Nome do Produto</label>
              <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group" style={{ width: '150px', margin: 0 }}>
              <label className="form-label">Preço Unitário (R$)</label>
              <input type="number" step="0.01" min="0" className="form-control" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating || !name || !price}>
              <PlusIcon size={15} />
              {creating ? 'Criando...' : 'Cadastrar Produto'}
            </button>
          </form>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome do Produto</th>
              <th>Preço</th>
              <th>Estoque Disponível</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando produtos...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                {searchTerm ? 'Nenhum produto correspondente à busca.' : 'Nenhum produto cadastrado.'}
              </td></tr>
            ) : filteredProducts.map(p => (
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
    </div>
  );
}
