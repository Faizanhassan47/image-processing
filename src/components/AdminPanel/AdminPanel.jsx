import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Users, KeyRound, ShieldAlert } from 'lucide-react';
import './AdminPanel.css';
import '../../styles/clinical.css?admin';
import { useAuth } from '../../modules/auth/AuthProvider';
import Modal from '../Modal/Modal';
import { apiFetch } from '../../api';

export default function AdminPanel({ API }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  // New User Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Technician');
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const passwordInputRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiFetch(`${API}/api/users`);
      if (response.ok) {
        setUsers(await response.json());
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      toast.error('Error loading users');
    }
  }, [API]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      toast.error('Error connecting to server');
    }
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
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
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
    } catch (error) {
      toast.error('Error connecting to server');
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (user?.role !== 'Admin') {
    return <div className="admin-panel error">You do not have permission to view this page.</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-layout">
        <div className="user-form-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <UserPlus size={18} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Create New User</h3>
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
                <option value="Admin">Admin</option>
                <option value="Pathologist">Pathologist</option>
                <option value="Technician">Technician</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-password">Password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength={4} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary">Create User</button>
          </form>
        </div>

        <div className="users-list-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Users size={18} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Existing Users</h3>
          </div>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.display_name}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => setPendingAction({ type: 'role', user: u, role: e.target.value })}
                        className="role-badge role-select"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Pathologist">Pathologist</option>
                        <option value="Technician">Technician</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="action-buttons">
                      <button type="button" className="btn-secondary" title="Reset Password" onClick={() => openPasswordReset(u)}>
                        <KeyRound size={14} style={{ marginRight: '4px' }} /> Reset
                      </button>
                      <button type="button" className="btn-delete" title="Delete User" onClick={() => setPendingAction({ type: 'delete', user: u })}>
                        <ShieldAlert size={14} style={{ marginRight: '4px' }} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="empty-users" colSpan="5">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
        <form id="reset-password-form" className="reset-password-form" onSubmit={handleResetPassword}>
          <p>Enter a new password for <strong>{passwordResetUser?.username}</strong>.</p>
          <label htmlFor="reset-password">New password</label>
          <input
            ref={passwordInputRef}
            id="reset-password"
            type="password"
            autoComplete="new-password"
            minLength={4}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Minimum 4 characters"
          />
        </form>
      </Modal>
      <Modal
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'delete' ? 'Delete user' : 'Change user role'}
        onClose={() => setPendingAction(null)}
        footer={(
          <>
            <button type="button" className="modal-button modal-button--secondary" onClick={() => setPendingAction(null)}>Cancel</button>
            <button
              type="button"
              className={pendingAction?.type === 'delete' ? 'modal-button btn-delete' : 'modal-button modal-button--primary'}
              onClick={() => pendingAction?.type === 'delete'
                ? handleDeleteUser(pendingAction.user.id)
                : handleUpdateRole(pendingAction.user.id, pendingAction.role)}
            >
              {pendingAction?.type === 'delete' ? 'Delete user' : 'Change role'}
            </button>
          </>
        )}
      >
        <p className="confirmation-copy">
          {pendingAction?.type === 'delete'
            ? <>Permanently delete <strong>{pendingAction?.user.username}</strong>?</>
            : <>Change <strong>{pendingAction?.user.username}</strong> from {pendingAction?.user.role} to <strong>{pendingAction?.role}</strong>?</>}
        </p>
      </Modal>
    </div>
  );
}
