import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Users, KeyRound, Power, PowerOff, ShieldAlert, Sparkles, Search } from 'lucide-react';
import './AdminPanel.css';
import { useAuth } from '../../modules/auth/AuthProvider';
import Modal from '../Modal/Modal';
import { apiFetch } from '../../api';
import { isAdministratorRole, isProtectedSuperAdmin, SUPER_ADMIN_ROLE, SYSTEM_ADMIN_ROLE, USER_ROLES } from '../../config/roles';
import AISubscriptions from './AISubscriptions';

const DEFAULT_PASSWORD_POLICY = { min_length: 8, require_letter_and_number: true };

function passwordValidationMessage(value, policy) {
  if (value.length < policy.min_length) return `Password must be at least ${policy.min_length} characters`;
  if (policy.require_letter_and_number && (!/[A-Za-z]/.test(value) || !/\d/.test(value))) return 'Password must contain both letters and numbers';
  return '';
}

function passwordPolicyHint(policy) {
  return `At least ${policy.min_length} characters${policy.require_letter_and_number ? ', including letters and numbers' : ''}.`;
}

export default function AdminPanel({ API }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === SUPER_ADMIN_ROLE || isProtectedSuperAdmin(user?.username);
  const manageableRoles = isSuperAdmin
    ? USER_ROLES
    : USER_ROLES.filter((item) => item.value === 'Laboratory Manager' || item.value === 'Pathologist');
  const [users, setUsers] = useState([]);

  // New User Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordPolicy, setPasswordPolicy] = useState(DEFAULT_PASSWORD_POLICY);
  const [role, setRole] = useState('Laboratory Manager');
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [aiAccessUserId, setAiAccessUserId] = useState(null);
  const passwordInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const visibleUsers = users.filter((item) => (isSuperAdmin || (item.role !== SUPER_ADMIN_ROLE && !isProtectedSuperAdmin(item.username)))
    && (roleFilter === 'All' || item.role === roleFilter)
    && `${item.username} ${item.display_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiFetch(`${API}/api/users`);
      if (response.ok) {
        setUsers(await response.json());
      } else {
        toast.error('Failed to load users');
      }
    } catch {
      toast.error('Error loading users');
    }
  }, [API]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiFetch(`${API}/api/users`);
        if (!mounted) return;
        if (response.ok) {
          setUsers(await response.json());
        } else {
          toast.error('Failed to load users');
        }
      } catch {
        if (mounted) toast.error('Error loading users');
      }
    })();
    return () => { mounted = false; };
  }, [API]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${API}/api/auth/password-policy`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const policy = await response.json();
        if (Number.isInteger(policy?.min_length) && policy.min_length > 0) {
          setPasswordPolicy({
            min_length: policy.min_length,
            require_letter_and_number: Boolean(policy.require_letter_and_number),
          });
        }
      })
      .catch((error) => { if (error.name !== 'AbortError') console.warn('Password policy could not be loaded.'); });
    return () => controller.abort();
  }, [API]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const passwordError = passwordValidationMessage(password, passwordPolicy);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    try {
      const response = await apiFetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          display_name: displayName,
          password,
          role
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`User ${data.username} created successfully!`);
        setUsername('');
        setDisplayName('');
        setPassword('');
        fetchUsers();
      } else {
        toast.error(data.detail || 'Failed to create user');
      }
    } catch {
      toast.error('Error connecting to server');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await apiFetch(`${API}/api/users/${userId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('User deleted successfully');
        setPendingAction(null);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to delete user');
      }
    } catch {
      toast.error('Error connecting to server');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await apiFetch(`${API}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        toast.success('Role updated successfully');
        setPendingAction(null);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to update role');
      }
    } catch {
      toast.error('Error connecting to server');
    }
  };

  const handleUpdateStatus = async (selectedUser, isActive) => {
    try {
      const response = await apiFetch(`${API}/api/users/${selectedUser.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: isActive }) });
      if (response.ok) { toast.success(`${selectedUser.username} is now ${isActive ? 'active' : 'inactive'}`); setPendingAction(null); fetchUsers(); }
      else { const data = await response.json(); toast.error(data.detail || 'Failed to update account status'); }
    } catch { toast.error('Error connecting to server'); }
  };

  const openAiAccess = (userId) => {
    setAiAccessUserId(userId);
    requestAnimationFrame(() => document.getElementById('ai-subscriptions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const openPasswordReset = (selectedUser) => {
    setPasswordResetUser(selectedUser);
    setNewPassword('');
  };

  const closePasswordReset = () => {
    if (isResettingPassword) return;
    setPasswordResetUser(null);
    setNewPassword('');
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const passwordError = passwordValidationMessage(newPassword, passwordPolicy);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await apiFetch(`${API}/api/users/${passwordResetUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (response.ok) {
        toast.success(`Password for ${passwordResetUser.username} reset successfully`);
        setPasswordResetUser(null);
        setNewPassword('');
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to reset password');
      }
    } catch {
      toast.error('Error connecting to server');
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (!isAdministratorRole(user?.role)) {
    return <div className="admin-panel error">You do not have permission to view this page.</div>;
  }

  return (
    <div className="admin-panel">
      <section className="admin-summary" aria-label="User account summary">
        <article><span>Total accounts</span><strong>{users.length}</strong></article>
        <article><span>Administrators</span><strong>{users.filter((item) => item.role === SYSTEM_ADMIN_ROLE).length}</strong></article>
        <article><span>Active accounts</span><strong>{users.filter((item) => item.is_active).length}</strong></article>
      </section>
      <div className="admin-layout">
        <div className="user-form-container">
          <div className="admin-section-heading">
            <UserPlus size={18} />
            <div><h3>Create user</h3><p>Provision an authorized local account.</p></div>
          </div>
          <form className="user-form" onSubmit={handleCreateUser}>
            <div className="form-group">
              <label htmlFor="new-username">Username</label>
              <input id="new-username" type="text" autoComplete="off" required value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="new-display-name">Display Name</label>
              <input id="new-display-name" type="text" autoComplete="off" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="new-role">Role</label>
              <select id="new-role" value={role} onChange={e => setRole(e.target.value)}>
                {manageableRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-password">Password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength={passwordPolicy.min_length} value={password} onChange={e => setPassword(e.target.value)} />
              <p className="password-policy-hint">{passwordPolicyHint(passwordPolicy)}</p>
            </div>
            <button type="submit" className="btn-primary">Create User</button>
          </form>
        </div>

        <div className="users-list-container">
          <div className="admin-section-heading">
            <Users size={18} />
            <div><h3>Existing users</h3><p>{users.length} configured account{users.length === 1 ? '' : 's'}</p></div>
          </div>
          <div className="admin-filters">
            <label className="admin-search"><Search size={15} /><span className="sr-only">Search users</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users" /></label>
            <label><span className="sr-only">Filter users by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All</option>{USER_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.display_name}</td>
                    <td>
                      {(u.username === user?.username || (!isSuperAdmin && [SUPER_ADMIN_ROLE, SYSTEM_ADMIN_ROLE].includes(u.role))) ? <span className="role-badge">{u.role}</span> : <select
                        value={u.role}
                        onChange={(e) => setPendingAction({ type: 'role', user: u, role: e.target.value })}
                        className="role-badge role-select"
                      >
                        {manageableRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>}
                    </td>
                    <td><span className={u.is_active ? 'account-status account-status--active' : 'account-status'}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td className="action-buttons">
                      <button type="button" className="btn-secondary" title="Reset Password" onClick={() => openPasswordReset(u)}>
                        <KeyRound size={14} /> Reset
                      </button>
                      {u.username !== user?.username && <button type="button" className="btn-secondary" title={u.is_active ? 'Deactivate user' : 'Activate user'} onClick={() => setPendingAction({ type: 'status', user: u, isActive: !u.is_active })}>{u.is_active ? <PowerOff size={14} /> : <Power size={14} />}{u.is_active ? 'Deactivate' : 'Activate'}</button>}
                      {(['Pathologist', 'Laboratory Manager'].includes(u.role) || (isSuperAdmin && u.role === SYSTEM_ADMIN_ROLE)) && <button type="button" className="btn-secondary" title="Manage AI access" onClick={() => openAiAccess(u.id)}><Sparkles size={14} /> AI access</button>}
                      {(isSuperAdmin || ![SUPER_ADMIN_ROLE, SYSTEM_ADMIN_ROLE].includes(u.role)) && <button type="button" className="btn-delete" title="Delete User" disabled={u.username === user?.username} onClick={() => setPendingAction({ type: 'delete', user: u })}>
                        <ShieldAlert size={14} /> Delete
                      </button>}
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td className="empty-users" colSpan="7">No users match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isAdministratorRole(user?.role) && <AISubscriptions selectedUserId={aiAccessUserId} onUserOpened={() => setAiAccessUserId(null)} />}
      <Modal
        open={Boolean(passwordResetUser)}
        title="Reset password"
        onClose={closePasswordReset}
        initialFocusRef={passwordInputRef}
        footer={(
          <>
            <button type="button" className="modal-button modal-button--secondary" onClick={closePasswordReset} disabled={isResettingPassword}>Cancel</button>
            <button type="submit" form="reset-password-form" className="modal-button modal-button--primary" disabled={isResettingPassword}>
              {isResettingPassword ? 'Resetting...' : 'Reset password'}
            </button>
          </>
        )}
      >
        <form id="reset-password-form" className="reset-password-form" autoComplete="off" onSubmit={handleResetPassword}>
          <p>Enter a new password for <strong>{passwordResetUser?.username}</strong>.</p>
          <input className="reset-password-form__account" type="text" name="username" autoComplete="username" value={passwordResetUser?.username || ''} readOnly tabIndex={-1} aria-hidden="true" />
          <label htmlFor="reset-password">New password</label>
          <input
            ref={passwordInputRef}
            id="reset-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            minLength={passwordPolicy.min_length}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={passwordPolicyHint(passwordPolicy)}
          />
          <p className="password-policy-hint">{passwordPolicyHint(passwordPolicy)}</p>
        </form>
      </Modal>
      <Modal
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'delete' ? 'Delete user' : pendingAction?.type === 'status' ? `${pendingAction?.isActive ? 'Activate' : 'Deactivate'} user` : 'Change user role'}
        onClose={() => setPendingAction(null)}
        footer={(
          <>
            <button type="button" className="modal-button modal-button--secondary" onClick={() => setPendingAction(null)}>Cancel</button>
            <button
              type="button"
              className={pendingAction?.type === 'delete' || pendingAction?.type === 'status' && !pendingAction?.isActive ? 'modal-button btn-delete' : 'modal-button modal-button--primary'}
              onClick={() => pendingAction?.type === 'delete' ? handleDeleteUser(pendingAction.user.id) : pendingAction?.type === 'status' ? handleUpdateStatus(pendingAction.user, pendingAction.isActive) : handleUpdateRole(pendingAction.user.id, pendingAction.role)}
            >
              {pendingAction?.type === 'delete' ? 'Delete user' : pendingAction?.type === 'status' ? pendingAction.isActive ? 'Activate user' : 'Deactivate user' : 'Change role'}
            </button>
          </>
        )}
      >
        <p className="confirmation-copy">
          {pendingAction?.type === 'delete' ? <>Permanently delete <strong>{pendingAction?.user.username}</strong>?</> : pendingAction?.type === 'status' ? <>{pendingAction.isActive ? 'Activate' : 'Deactivate'} <strong>{pendingAction.user.username}</strong>? {pendingAction.isActive ? 'They will be able to sign in again.' : 'They will not be able to sign in until reactivated.'}</> : <>Change <strong>{pendingAction?.user.username}</strong> from {pendingAction?.user.role} to <strong>{pendingAction?.role}</strong>?</>}
        </p>
      </Modal>
    </div>
  );
}
