import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BrainCircuit } from 'lucide-react';
import { aiSubscriptionService } from '../../services/aiSubscriptionService';
import { useAuth } from '../../modules/auth/AuthProvider';
import { isProtectedSuperAdmin } from '../../config/roles';
import Modal from '../Modal/Modal';
import './AISubscriptions.css';

const isoDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const activeOf = (user) => user.subscriptions.find((item) => item.status === 'Active') || user.subscriptions[0];

export default function AISubscriptions({ selectedUserId, onUserOpened }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [features, setFeatures] = useState([]);
  const [myEntitlements, setMyEntitlements] = useState(null);
  const [editing, setEditing] = useState(null);
  const [historyUserId, setHistoryUserId] = useState(null);

  const isSuperAdmin = isProtectedSuperAdmin(currentUser?.username) || currentUser?.role === 'Super Administrator';

  const load = useCallback((signal) => Promise.all([
    aiSubscriptionService.adminList(signal),
    aiSubscriptionService.features(signal),
    aiSubscriptionService.entitlements(signal),
  ]).then(([accountData, featureData, entData]) => {
    setUsers(accountData);
    setFeatures(featureData);
    setMyEntitlements(entData);
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((e) => e.name !== 'AbortError' && toast.error(e.message));
    return () => controller.abort();
  }, [load]);

  // If regular System Administrator, only allow assigning features that this admin has paid for / is entitled to.
  // Super Administrator has no restriction.
  const assignableFeatures = isSuperAdmin
    ? features
    : features.filter((f) => myEntitlements?.effective_feature_codes?.includes(f.feature_code));

  const open = useCallback((account) => {
    const subscription = activeOf(account);
    const today = new Date();
    const nextYear = new Date(); nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
    setEditing({ user: account, subscription, plan_name: subscription?.plan_name || 'AI Research', start_date: isoDate(subscription?.start_date) || isoDate(today), end_date: isoDate(subscription?.end_date) || isoDate(nextYear), feature_codes: (subscription?.features || []).filter((f) => f.is_enabled).map((f) => f.feature_code) });
  }, []);
  useEffect(() => {
    if (!selectedUserId) return;
    const selectedAccount = users.find((account) => account.id === selectedUserId);
    if (selectedAccount) { open(selectedAccount); onUserOpened?.(); }
  }, [onUserOpened, open, selectedUserId, users]);
  const save = async (event) => {
    event.preventDefault();
    try {
      let subscription;
      if (editing.subscription) {
        subscription = await aiSubscriptionService.update(editing.subscription.id, { plan_name: editing.plan_name, start_date: `${editing.start_date}T00:00:00Z`, end_date: `${editing.end_date}T23:59:59Z`, status: 'Active' });
        await aiSubscriptionService.setFeatures(subscription.id, editing.feature_codes);
      } else {
        subscription = await aiSubscriptionService.create({ user_id: editing.user.id, plan_name: editing.plan_name, start_date: `${editing.start_date}T00:00:00Z`, end_date: `${editing.end_date}T23:59:59Z`, feature_codes: editing.feature_codes });
      }
      toast.success('AI subscription saved.'); setEditing(null); await load();
    } catch (error) { toast.error(error.message); }
  };
  const changeStatus = async (subscription, status) => {
    if (!window.confirm(`${status} this AI subscription? New AI analysis will be blocked.`)) return;
    try { if (status === 'Cancelled') await aiSubscriptionService.cancel(subscription.id); else await aiSubscriptionService.update(subscription.id, { status }); toast.success(`Subscription ${status.toLowerCase()}.`); await load(); } catch (error) { toast.error(error.message); }
  };

  const toggleFeature = (featureCode) => {
    setEditing((current) => ({
      ...current,
      feature_codes: current.feature_codes.includes(featureCode)
        ? current.feature_codes.filter((code) => code !== featureCode)
        : [...current.feature_codes, featureCode],
    }));
  };

  const close = () => setEditing(null);

  return (
    <Modal
      open={Boolean(editing)}
      title={editing ? `AI access — ${editing.user.display_name || editing.user.username}` : 'AI access'}
      onClose={close}
      footer={<><button type="button" className="modal-button modal-button--secondary" onClick={close}>Cancel</button><button type="submit" form="ai-access-form" className="modal-button modal-button--primary">Save AI access</button></>}
    >
      {editing && <form id="ai-access-form" className="ai-subscription-editor" onSubmit={save}>
        <header>
          <div><h4><BrainCircuit size={18} /> AI feature entitlement</h4><p>Grant active, executable AI features to this account. Access becomes effective immediately after saving.</p></div>
        </header>
        <div className="ai-subscription-editor__fields">
          <label>Plan name<input value={editing.plan_name} onChange={(event) => setEditing((current) => ({ ...current, plan_name: event.target.value }))} required /></label>
          <label>Starts on<input type="date" value={editing.start_date} onChange={(event) => setEditing((current) => ({ ...current, start_date: event.target.value }))} required /></label>
          <label>Ends on<input type="date" value={editing.end_date} min={editing.start_date} onChange={(event) => setEditing((current) => ({ ...current, end_date: event.target.value }))} required /></label>
        </div>
        <fieldset>
          <legend>Feature access</legend>
          {!assignableFeatures.length && <p className="ai-subscription-editor__empty">No AI features can be assigned with your current administrator entitlement.</p>}
          {assignableFeatures.map((feature) => {
            const unavailable = !feature.is_active || !feature.is_implemented;
            return <label key={feature.id} className={unavailable ? 'ai-subscription-editor__feature--unavailable' : ''}>
              <input type="checkbox" checked={editing.feature_codes.includes(feature.feature_code)} disabled={unavailable} onChange={() => toggleFeature(feature.feature_code)} />
              <span><strong>{feature.feature_name}</strong><small>{unavailable ? (!feature.is_implemented ? 'Coming soon — not executable' : 'Disabled globally') : feature.description}</small></span>
            </label>;
          })}
        </fieldset>
      </form>}
    </Modal>
  );

}
