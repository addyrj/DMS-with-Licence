// src/app/(admin)/admin/users/page.js
// FIX: default tab is "Employees" — display_ accounts hidden by default.
//      "All Users" tab still exists but is not the default.
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, createUser, updateUser, deleteUser,
  toggleUserStatus, changeUserPassword, getDisplays, getLines,
} from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { useAuth } from '../../../../lib/auth';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import Toggle from '../../../../components/ui/Toggle';
import { Field, Input, Select } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import Avatar from '../../../../components/ui/Avatar';
import { Plus, Trash2, Edit, Key, Search } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';

export default function UsersPage() {
  const toast    = useToast();
  const qc       = useQueryClient();
  const { user } = useAuth();
  const inv      = () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['users-all'] }); };

  const PAGE_SIZE = 15;
  const [searchText, setSearchText] = useState('');
  // FIX: default is 'employee' not 'all' — display_ accounts hidden by default
  const [userType, setUserType] = useState('employee');

  // Tab counts (Employees/Displays/All) need the full user set, not just the
  // visible page — kept as a separate full-set fetch.
  const { data: allData } = useQuery({ queryKey: ['users-all'], queryFn: () => getUsers({ limit: 500 }) });
  const allUsers = allData?.users || [];

  const {
    data, isLoading, page, setPage, total, totalPages, setSearchInput,
  } = useServerPagination(
    ['users', userType],
    (params) => getUsers({ ...params, type: userType === 'all' ? undefined : userType }),
    { limit: PAGE_SIZE }
  );
  const users = data?.users || [];

  // Dropdown sources — need the full set, not one page
  const { data: dispData }  = useQuery({ queryKey: ['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  const { data: lineData }  = useQuery({ queryKey: ['lines-all'],    queryFn: () => getLines({ limit: 500 }) });
  const displays = dispData?.displays || [];
  const lines    = lineData?.lines    || [];

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [pwModal,     setPwModal]     = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const blank = { username:'', email:'', password:'', production_line_id:'', assigned_display_id:'', has_delete_permission:false };
  const [form,  setForm]  = useState(blank);
  const [newPw, setNewPw] = useState('');

  const setUsername   = e => setForm(f => ({ ...f, username: e.target.value }));
  const setEmail      = e => setForm(f => ({ ...f, email: e.target.value }));
  const setPassword   = e => setForm(f => ({ ...f, password: e.target.value }));
  const setLineId     = e => setForm(f => ({ ...f, production_line_id: e.target.value }));
  const setDisplayId  = e => setForm(f => ({ ...f, assigned_display_id: e.target.value }));
  const setDeletePerm = v => setForm(f => ({ ...f, has_delete_permission: v }));

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => { inv(); setCreateModal(false); setForm(blank); toast('User created!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const editMut = useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    onSuccess: () => { inv(); setEditModal(null); toast('User updated!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const pwMut = useMutation({
    mutationFn: ({ id, pw }) => changeUserPassword(id, { new_password: pw }),
    onSuccess: () => { setPwModal(null); setNewPw(''); toast('Password changed!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => { inv(); setDeleteModal(null); toast('User deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const toggleMut = useMutation({
    mutationFn: (id) => toggleUserStatus(id),
    onSuccess: inv,
    onError:   (e) => toast(e.message, 'danger'),
  });

  const openEdit = (u) => {
    setForm({
      username:            u.username,
      email:               u.email || '',
      password:            '',
      production_line_id:  u.production_line_id  || '',
      assigned_display_id: u.assigned_display_id || '',
      has_delete_permission: !!u.has_delete_permission,
    });
    setEditModal(u);
  };

  const isAdminUser = (u) => u.id === user?.id && user?.role === 'CLIENT_ADMIN';

  const formFields = (mode) => (
    <div className="form-grid">
      <Field label="Username *">
        <Input placeholder="e.g. john_operator" value={form.username} onChange={setUsername} disabled={mode === 'edit'}/>
      </Field>
      <Field label="Email" hint="Optional">
        <Input type="email" placeholder="e.g. john@company.com" value={form.email} onChange={setEmail}/>
      </Field>
      {mode === 'create' && (
        <Field label="Password *" hint="Min 8 characters">
          <Input type="password" placeholder="Enter password" value={form.password} onChange={setPassword}/>
        </Field>
      )}
      <Field label="Assign to Production Line">
        <Select value={form.production_line_id} onChange={setLineId}>
          <option value="">— None —</option>
          {lines.map(l => <option key={l.id} value={l.id}>{l.production_line_name}</option>)}
        </Select>
      </Field>
      <Field label="Assign to Display">
        <Select value={form.assigned_display_id} onChange={setDisplayId}>
          <option value="">— None —</option>
          {displays.map(d => <option key={d.id} value={d.id}>{d.display_name} ({d.display_number})</option>)}
        </Select>
      </Field>
      <Toggle checked={form.has_delete_permission} onChange={setDeletePerm} label="Allow delete permission"/>
    </div>
  );

  // Tab labels with counts (from the full-set fetch, not the visible page)
  const empCount  = allUsers.filter(u => !u.username?.startsWith('display_')).length;
  const dispCount = allUsers.filter(u =>  u.username?.startsWith('display_')).length;

  return (
    <div>
      <div className="page-header">
        <div><h2>Users</h2><p>Manage employee accounts and display assignments</p></div>
        <Button variant="primary" onClick={() => { setForm(blank); setCreateModal(true); }}>
          <Plus size={16}/> Add User
        </Button>
      </div>

      <Card>
        <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
          {/* FIX: Employees is default tab */}
          {[
            { key:'employee', label:`👤 Employees (${empCount})` },
            { key:'display',  label:`📺 Displays (${dispCount})` },
            { key:'all',      label:`All (${allUsers.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => { setUserType(t.key); setPage(1); }}
              style={{ padding:'6px 14px', borderRadius:99, border:'1px solid var(--border)',
                background: userType===t.key ? 'var(--primary)' : 'white',
                color: userType===t.key ? 'white' : 'var(--text-body)',
                cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {t.label}
            </button>
          ))}
          <div style={{ flex:1, position:'relative' }}>
            <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input className="input" style={{ paddingLeft:38 }}
              placeholder="Search by username, email, line, display…"
              value={searchText} onChange={e => { setSearchText(e.target.value); setSearchInput(e.target.value); }}/>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Production Line</th><th>Display</th><th>Del Perm</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {isLoading && [...Array(3)].map((_,i) => (
                <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height:20 }}/></td></tr>
              ))}
              {users.map(u => {
                const isAdmin   = isAdminUser(u);
                const isDisplay = u.username?.startsWith('display_');
                return (
                  <tr key={u.id} style={{ background: isAdmin ? 'var(--primary-10)' : undefined }}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar name={u.username} size="sm"/>
                        <div>
                          <div className="table__name">
                            {u.username}
                            {isAdmin && <span style={{ marginLeft:6, fontSize:11, background:'var(--primary)', color:'white', padding:'1px 6px', borderRadius:99, fontWeight:600 }}>YOU</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email || '—'}</td>
                    <td>
                      {isAdmin    ? <Badge variant="primary">Admin</Badge>
                       : isDisplay ? <Badge variant="muted">Display</Badge>
                       : <Badge variant="muted">Employee</Badge>}
                    </td>
                    <td style={{ fontSize:13 }}>{u.production_line_name || '—'}</td>
                    <td>{u.display_number ? <code style={{ fontSize:12 }}>{u.display_number}</code> : '—'}</td>
                    <td>
                      {isAdmin ? <Badge variant="success">All ✓</Badge>
                       : <Badge variant={u.has_delete_permission?'warning':'muted'}>{u.has_delete_permission?'Yes':'No'}</Badge>}
                    </td>
                    <td><Badge variant={u.is_active?'success':'danger'} dot>{u.is_active?'Active':'Inactive'}</Badge></td>
                    <td>
                      {isAdmin ? (
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>Admin account</span>
                      ) : (
                        <div style={{ display:'flex', gap:6 }}>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Edit size={14}/></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setPwModal(u); setNewPw(''); }}><Key size={14}/></Button>
                          <Button variant="ghost" size="sm" loading={toggleMut.isPending} onClick={() => toggleMut.mutate(u.id)}>
                            <span style={{ fontSize:11, fontWeight:700, color:u.is_active?'var(--warning)':'var(--success)' }}>
                              {u.is_active?'OFF':'ON'}
                            </span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal(u)}><Trash2 size={14} color="var(--danger)"/></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty"><div className="empty__icon">👥</div><div className="empty__title">{searchText ? 'No users match' : 'No users yet'}</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </Card>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add New User"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending} onClick={() => createMut.mutate({
            username: form.username, email: form.email || undefined, password: form.password,
            production_line_id:  form.production_line_id  ? Number(form.production_line_id)  : undefined,
            assigned_display_id: form.assigned_display_id ? Number(form.assigned_display_id) : undefined,
            has_delete_permission: form.has_delete_permission,
          })}>Create User</Button>
        </>}>{formFields('create')}</Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit — ${editModal?.username}`}
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          <Button variant="primary" loading={editMut.isPending} onClick={() => editMut.mutate({
            id: editModal.id,
            body: {
              email: form.email || null,
              production_line_id:  form.production_line_id  ? Number(form.production_line_id)  : null,
              assigned_display_id: form.assigned_display_id ? Number(form.assigned_display_id) : null,
              has_delete_permission: form.has_delete_permission,
            },
          })}>Save Changes</Button>
        </>}>{formFields('edit')}</Modal>

      <Modal open={!!pwModal} onClose={() => setPwModal(null)} title={`Change Password — ${pwModal?.username}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setPwModal(null)}>Cancel</Button>
          <Button variant="primary" loading={pwMut.isPending} onClick={() => pwMut.mutate({ id: pwModal.id, pw: newPw })}>
            Update Password
          </Button>
        </>}>
        <Field label="New Password" hint="Minimum 8 characters">
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password"/>
        </Field>
      </Modal>

      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete User" message={`Permanently delete "${deleteModal?.username}"?`}
        loading={deleteMut.isPending} onConfirm={() => deleteMut.mutate(deleteModal.id)}/>
    </div>
  );
}