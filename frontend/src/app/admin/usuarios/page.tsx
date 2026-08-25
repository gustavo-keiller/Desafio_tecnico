"use client";

import { useState, useEffect } from 'react';
import { useAuth, authFetch, Role } from '../../auth';
import { 
  UsersIcon, 
  KeyIcon, 
  StarIcon, 
  ActivityIcon, 
  PlusIcon, 
  CheckCircleIcon, 
  PercentIcon, 
  ZapIcon, 
  PackageIcon 
} from '../../icons';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  isVip?: boolean;
  customPermissions?: string[] | null;
  createdAt?: string;
}

interface PermissionDef {
  code: string;
  name: string;
  category: string;
  description: string;
}

interface QueueMetrics {
  totalProcessed: number;
  pendingTasks: number;
  isProcessing: boolean;
  averageWaitTimeMs: number;
  averageExecutionTimeMs: number;
}

const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Super Admin',
  Seller: 'Vendedor',
  Client: 'Cliente',
  InventoryManager: 'Gerente de Estoque',
};

export default function AdminUsersPage() {
  const { user, refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'vip'>('users');

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [togglingVipId, setTogglingVipId] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Client');
  const [isVip, setIsVip] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('Client');
  const [editIsVip, setEditIsVip] = useState(false);
  const [saving, setSaving] = useState(false);

  // User Permissions Customization Modal/Card
  const [permEditingUser, setPermEditingUser] = useState<UserData | null>(null);
  const [selectedUserPerms, setSelectedUserPerms] = useState<string[]>([]);
  const [isUsingDefaultRolePerms, setIsUsingDefaultRolePerms] = useState(true);
  const [savingUserPerms, setSavingUserPerms] = useState(false);

  // Permissions Matrix State
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/users', {}, user);
      if (!res.ok) throw new Error('Falha ao carregar lista de usuários');
      const data = await res.json();
      setUsers(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueMetrics = async () => {
    if (!user || user.role !== 'Admin') return;
    try {
      const res = await authFetch('/orders/queue/metrics', {}, user);
      if (res.ok) {
        const data = await res.json();
        setQueueMetrics(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchPermissionsMatrix = async () => {
    if (!user) return;
    setPermLoading(true);
    try {
      const [catRes, matrixRes] = await Promise.all([
        authFetch('/permissions/catalog', {}, user),
        authFetch('/permissions/roles', {}, user),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCatalog(catData);
      }
      if (matrixRes.ok) {
        const matrixData = await matrixRes.json();
        setRolePermissions(matrixData);
      }
    } catch (err: any) {
      setError('Falha ao carregar matriz de permissões');
    } finally {
      setPermLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers();
      fetchQueueMetrics();
      fetchPermissionsMatrix();
    } else {
      setError('Acesso negado. Apenas administradores podem gerenciar usuários.');
      setLoading(false);
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const res = await authFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, isVip }),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao criar usuário');
      }

      setName('');
      setEmail('');
      setRole('Client');
      setIsVip(false);
      setShowCreate(false);
      setSuccess('Usuário criado com sucesso!');
      await fetchUsers();
      await refreshUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u: UserData) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditIsVip(Boolean(u.isVip));
    setPermEditingUser(null);
    setError('');
    setSuccess('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await authFetch(`/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole, isVip: editIsVip }),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao atualizar usuário');
      }

      setEditingUser(null);
      setSuccess('Usuário atualizado com sucesso!');
      await fetchUsers();
      await refreshUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startUserPermsEdit = (u: UserData) => {
    setPermEditingUser(u);
    setEditingUser(null);
    setShowCreate(false);
    setError('');
    setSuccess('');

    const allowedByRole = rolePermissions[u.role] || [];
    if (!u.customPermissions) {
      setIsUsingDefaultRolePerms(true);
      setSelectedUserPerms(allowedByRole);
    } else {
      setIsUsingDefaultRolePerms(false);
      // Filter custom permissions so user cannot have permissions not enabled for role
      setSelectedUserPerms(u.customPermissions.filter(p => allowedByRole.includes(p)));
    }
  };

  const toggleUserPerm = (code: string) => {
    setIsUsingDefaultRolePerms(false);
    if (selectedUserPerms.includes(code)) {
      setSelectedUserPerms(prev => prev.filter(p => p !== code));
    } else {
      setSelectedUserPerms(prev => [...prev, code]);
    }
  };

  const handleResetToRoleDefault = () => {
    if (!permEditingUser) return;
    const allowedByRole = rolePermissions[permEditingUser.role] || [];
    setIsUsingDefaultRolePerms(true);
    setSelectedUserPerms(allowedByRole);
  };

  const handleSaveUserPermissions = async () => {
    if (!permEditingUser) return;
    setSavingUserPerms(true);
    setError('');
    setSuccess('');

    try {
      const payloadPermissions = isUsingDefaultRolePerms ? null : selectedUserPerms;
      const res = await authFetch(`/users/${permEditingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPermissions: payloadPermissions }),
      }, user);

      if (!res.ok) throw new Error('Falha ao atualizar permissões do perfil do usuário');

      setSuccess(`Permissões do perfil "${permEditingUser.name}" atualizadas com sucesso!`);
      setPermEditingUser(null);
      await fetchUsers();
      await refreshUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingUserPerms(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      const res = await authFetch(`/users/${id}`, { method: 'DELETE' }, user);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao excluir usuário');
      }
      setSuccess('Usuário excluído com sucesso!');
      await fetchUsers();
      await refreshUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleVip = async (targetUser: UserData) => {
    setTogglingVipId(targetUser.id);
    setError('');
    setSuccess('');
    try {
      const newVip = !targetUser.isVip;
      const res = await authFetch(`/users/${targetUser.id}/vip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVip: newVip }),
      }, user);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao atualizar status VIP');
      }

      setSuccess(
        newVip
          ? `O cliente "${targetUser.name}" agora é VIP! (10% de desconto comercial e prioridade na fila ativados)`
          : `O cliente "${targetUser.name}" retornou ao status de Cliente Padrão.`
      );
      await fetchUsers();
      await refreshUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingVipId(null);
    }
  };

  const handleSaveRole = async (r: Role) => {
    if (!user) return;
    setSavingRole(r);
    setError('');
    setSuccess('');
    try {
      const perms = rolePermissions[r] || [];
      const res = await authFetch(`/permissions/roles/${r}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      }, user);

      if (!res.ok) throw new Error(`Falha ao salvar permissões do cargo ${ROLE_LABELS[r]}`);
      setSuccess(`Permissões do cargo "${ROLE_LABELS[r]}" atualizadas com sucesso!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingRole(null);
    }
  };

  const togglePermission = (r: Role, code: string) => {
    if (r === 'Admin') return; // Admin has ALL permissions active
    const current = rolePermissions[r] || [];
    const hasIt = current.includes(code);
    const updated = hasIt ? current.filter(p => p !== code) : [...current, code];
    setRolePermissions(prev => ({ ...prev, [r]: updated }));
  };

  if (user?.role !== 'Admin') {
    return <div style={{ color: 'var(--danger)', padding: '2rem' }}>{error || 'Acesso negado'}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ margin: 0 }}>Gerenciamento de Usuários e Permissões</h1>
        {activeTab === 'users' && (
          <button
            className="btn btn-primary"
            onClick={() => { setShowCreate(!showCreate); setEditingUser(null); setPermEditingUser(null); }}
          >
            {showCreate ? 'Cancelar' : <><PlusIcon size={14} /> Novo Usuário</>}
          </button>
        )}
      </div>

      {/* Queue Performance Telemetry */}
      {queueMetrics && (
        <div className="card mb-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1.25rem 1.5rem' }}>
          <div className="flex justify-between items-center mb-2">
            <h4 style={{ margin: 0, color: '#0F172A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ActivityIcon size={16} color="#2563EB" />
              Telemetria da Fila de Processamento & Concorrência
            </h4>
            <span className="badge badge-success" style={{ padding: '0.3rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircleIcon size={12} color="#059669" />
              {queueMetrics.isProcessing ? 'Processando Tarefas Ativamente' : 'Fila Pronta / Ociosa'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-3">
            <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <p className="form-label" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarefas Processadas</p>
              <p className="title" style={{ fontSize: '1.35rem', margin: '0.2rem 0 0 0' }}>{queueMetrics.totalProcessed}</p>
            </div>
            <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <p className="form-label" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarefas Pendentes</p>
              <p className="title" style={{ fontSize: '1.35rem', margin: '0.2rem 0 0 0', color: queueMetrics.pendingTasks > 0 ? '#F59E0B' : '#10B981' }}>
                {queueMetrics.pendingTasks}
              </p>
            </div>
            <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <p className="form-label" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tempo Médio de Espera</p>
              <p className="title" style={{ fontSize: '1.35rem', margin: '0.2rem 0 0 0', color: '#2563EB' }}>{queueMetrics.averageWaitTimeMs} ms</p>
            </div>
            <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <p className="form-label" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tempo Execução DB</p>
              <p className="title" style={{ fontSize: '1.35rem', margin: '0.2rem 0 0 0', color: '#6366F1' }}>{queueMetrics.averageExecutionTimeMs} ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('users')}
        >
          <UsersIcon size={15} />
          Usuários Cadastrados
        </button>
        <button
          className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('permissions')}
        >
          <KeyIcon size={15} />
          Matriz de Permissões por Cargo
        </button>
        <button
          className={`btn ${activeTab === 'vip' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('vip')}
        >
          <StarIcon size={15} color={activeTab === 'vip' ? '#FFFFFF' : '#D97706'} />
          Clientes VIPs & Benefícios
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--success)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <>
          {showCreate && (
            <div className="card mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
              <h3 style={{ marginBottom: '1rem' }}>Cadastrar Novo Usuário</h3>
              <form onSubmit={handleCreate}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Nome</label>
                    <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">E-mail</label>
                    <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Permissão (Role)</label>
                    <select 
                      className="form-control" 
                      value={role} 
                      onChange={e => {
                        const newRole = e.target.value as Role;
                        setRole(newRole);
                        if (newRole !== 'Client') setIsVip(false);
                      }} 
                      required
                    >
                      <option value="Client">Cliente</option>
                      <option value="Seller">Vendedor</option>
                      <option value="InventoryManager">Gerente de Estoque</option>
                      <option value="Admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3">
                  {role === 'Client' ? (
                    <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px' }} 
                        checked={isVip} 
                        onChange={e => setIsVip(e.target.checked)} 
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <StarIcon size={14} color="#D97706" /> 
                        <strong>Cliente VIP / Prioritário na Fila</strong> (10% de desconto e alta prioridade)
                      </span>
                    </label>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      * O status VIP é um benefício exclusivo para contas de <strong>Cliente</strong>.
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Salvando...' : 'Cadastrar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {editingUser && (
            <div className="card mb-4" style={{ borderLeft: '4px solid #f59e0b' }}>
              <h3 style={{ marginBottom: '1rem' }}>Editar Usuário: {editingUser.name}</h3>
              <form onSubmit={handleUpdate}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Nome</label>
                    <input type="text" className="form-control" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">E-mail</label>
                    <input type="email" className="form-control" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Permissão (Role)</label>
                    <select 
                      className="form-control" 
                      value={editRole} 
                      onChange={e => {
                        const newRole = e.target.value as Role;
                        setEditRole(newRole);
                        if (newRole !== 'Client') setEditIsVip(false);
                      }} 
                      required
                    >
                      <option value="Client">Cliente</option>
                      <option value="Seller">Vendedor</option>
                      <option value="InventoryManager">Gerente de Estoque</option>
                      <option value="Admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3">
                  {editRole === 'Client' ? (
                    <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px' }} 
                        checked={editIsVip} 
                        onChange={e => setEditIsVip(e.target.checked)} 
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <StarIcon size={14} color="#D97706" /> 
                        <strong>Cliente VIP / Prioritário na Fila</strong> (10% de desconto e alta prioridade)
                      </span>
                    </label>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      * O status VIP é um benefício exclusivo para contas de <strong>Cliente</strong>.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingUser(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* User Custom Permissions Editor Card */}
          {permEditingUser && (
            <div className="card mb-4" style={{ borderLeft: '4px solid #3b82f6', background: 'var(--bg-color)' }}>
              <div className="flex justify-between items-center mb-2">
                <h3 style={{ margin: 0 }}>
                  🔒 Ajustar Permissões Específicas do Perfil: {permEditingUser.name}
                </h3>
                <span className={`badge badge-${permEditingUser.role}`}>
                  Cargo: {ROLE_LABELS[permEditingUser.role]}
                </span>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                O perfil pode ter <strong>todas as permissões ativas do cargo ({ROLE_LABELS[permEditingUser.role]}) ou menos</strong>. Permissões desativadas no nível do cargo não podem ser concedidas ao usuário.
              </p>

              {isUsingDefaultRolePerms && (
                <div style={{ background: '#1e293b', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ℹ️ Este usuário está utilizando o padrão 100% herdado do cargo ({ROLE_LABELS[permEditingUser.role]}).
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                {catalog.map(perm => {
                  const isRoleAllowed = (rolePermissions[permEditingUser.role] || []).includes(perm.code) || permEditingUser.role === 'Admin';
                  const isChecked = isRoleAllowed && selectedUserPerms.includes(perm.code);

                  return (
                    <div
                      key={perm.code}
                      className="flex items-center gap-3 p-2 rounded"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        opacity: isRoleAllowed ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: '18px', height: '18px', cursor: isRoleAllowed ? 'pointer' : 'not-allowed' }}
                        checked={isChecked}
                        disabled={!isRoleAllowed || permEditingUser.role === 'Admin'}
                        onChange={() => toggleUserPerm(perm.code)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                          {perm.name}
                          {!isRoleAllowed && (
                            <span className="badge" style={{ background: 'var(--danger)', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                              Desativado no Cargo
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{perm.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={handleResetToRoleDefault}>
                  🔄 Resetar para Padrão do Cargo
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={handleSaveUserPermissions} disabled={savingUserPerms}>
                    {savingUserPerms ? 'Salvando...' : 'Salvar Permissões do Perfil'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setPermEditingUser(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Status de Permissões</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>Carregando usuários...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum usuário cadastrado.</td></tr>
                ) : users.map(u => {
                  const rolePermCount = (rolePermissions[u.role] || []).length;
                  const customPermCount = u.customPermissions ? u.customPermissions.length : null;
                  const isRestricted = customPermCount !== null && customPermCount < rolePermCount;

                  return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'monospace' }}>{u.id.slice(0, 8)}...</td>
                      <td style={{ fontWeight: '500' }}>
                        {u.name}
                        {u.role === 'Client' && u.isVip && (
                          <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            <StarIcon size={12} color="#D97706" /> VIP
                          </span>
                        )}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {u.role === 'Admin' ? (
                          <span className="badge badge-success">Todas (Total)</span>
                        ) : isRestricted ? (
                          <span className="badge" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
                            Restrito ({customPermCount}/{rolePermCount} do Cargo)
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                            100% do Cargo ({rolePermCount} ativas)
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => startEdit(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#93C5FD', color: '#2563EB' }}
                            onClick={() => startUserPermsEdit(u)}
                          >
                            Permissões
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(u.id, u.name)}
                            disabled={u.id === user.id}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: ROLE PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div>
          <div className="card mb-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Matriz de Permissões Padrão por Cargo</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Defina as permissões base para cada papel de acesso. Quando um novo usuário é cadastrado, ele herda automaticamente a configuração do seu cargo.
            </p>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Permissão / Recurso</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>
                    Super Admin
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Todas (Total)</div>
                  </th>
                  {(['Seller', 'InventoryManager', 'Client'] as Role[]).map(r => (
                    <th key={r} style={{ minWidth: '140px', textAlign: 'center' }}>
                      <div>{ROLE_LABELS[r]}</div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', marginTop: '0.25rem' }}
                        disabled={savingRole === r}
                        onClick={() => handleSaveRole(r)}
                      >
                        {savingRole === r ? 'Salvando...' : 'Salvar Cargo'}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog.map(perm => (
                  <tr key={perm.code}>
                    <td>
                      <strong>{perm.name}</strong>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{perm.description}</p>
                    </td>
                    {(['Admin', 'Seller', 'InventoryManager', 'Client'] as Role[]).map(r => {
                      const isChecked = r === 'Admin' ? true : (rolePermissions[r] || []).includes(perm.code);
                      return (
                        <td key={r} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ width: '18px', height: '18px', cursor: r === 'Admin' ? 'not-allowed' : 'pointer' }}
                            checked={isChecked}
                            disabled={r === 'Admin'}
                            onChange={() => togglePermission(r, perm.code)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VIP CLIENTS & BENEFITS MANAGEMENT */}
      {activeTab === 'vip' && (
        <div>
          {/* Active VIP Benefits Overview Cards */}
          <div className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.4) 0%, rgba(255, 255, 255, 0) 100%)', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 mb-3">
              <div style={{ background: '#FEF3C7', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StarIcon size={18} color="#D97706" />
              </div>
              <h3 style={{ margin: 0, color: '#92400E' }}>Benefícios Comerciais para Clientes VIPs</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Os clientes promovidos a VIP recebem vantagens automáticas no motor transacional e no atendimento de pedidos:
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ background: '#ECFDF5', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  <PercentIcon size={18} color="#059669" />
                </div>
                <strong style={{ color: '#059669', fontSize: '0.95rem' }}>10% de Desconto Comercial</strong>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Aplicado automaticamente sobre o valor total em qualquer pedido gerado pelo cliente.
                </p>
              </div>

              <div style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ background: '#EFF6FF', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  <ZapIcon size={18} color="#2563EB" />
                </div>
                <strong style={{ color: '#2563EB', fontSize: '0.95rem' }}>Fila Rápida de Concorrência</strong>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Prioridade máxima no motor de fila: passa na frente de pedidos padrão em picos de concorrência.
                </p>
              </div>

              <div style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ background: '#FFFBEB', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  <PackageIcon size={18} color="#D97706" />
                </div>
                <strong style={{ color: '#D97706', fontSize: '0.95rem' }}>Destaque Operacional</strong>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Identificação visual VIP no painel geral e na fila de separação do armazém.
                </p>
              </div>
            </div>
          </div>

          {/* VIP Clients Management Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome do Cliente</th>
                  <th>E-mail</th>
                  <th>Status do Cliente</th>
                  <th>Benefícios Ativos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === 'Client').length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Nenhum cliente cadastrado no sistema.
                    </td>
                  </tr>
                ) : (
                  users.filter(u => u.role === 'Client').map(clientUser => (
                    <tr key={clientUser.id}>
                      <td style={{ fontWeight: '600' }}>
                        {clientUser.name}
                        {clientUser.isVip && (
                          <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            <StarIcon size={12} color="#D97706" /> VIP
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{clientUser.email}</td>
                      <td>
                        <span className={`badge ${clientUser.isVip ? 'badge-success' : 'badge-outline'}`} style={{ 
                          background: clientUser.isVip ? '#DCFCE7' : undefined, 
                          color: clientUser.isVip ? '#15803D' : undefined,
                          borderColor: clientUser.isVip ? '#BBF7D0' : undefined,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          {clientUser.isVip ? (
                            <><StarIcon size={12} color="#15803D" /> Cliente VIP</>
                          ) : (
                            'Cliente Padrão'
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {clientUser.isVip ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <CheckCircleIcon size={13} color="#059669" /> 10% Desconto + Fila Rápida
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            Preço de tabela regular
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn ${clientUser.isVip ? 'btn-outline' : 'btn-primary'}`}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                          disabled={togglingVipId === clientUser.id}
                          onClick={() => handleToggleVip(clientUser)}
                        >
                          {togglingVipId === clientUser.id ? (
                            'Atualizando...'
                          ) : clientUser.isVip ? (
                            'Remover VIP'
                          ) : (
                            <><StarIcon size={13} color="#FFFFFF" /> Tornar Cliente VIP</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
