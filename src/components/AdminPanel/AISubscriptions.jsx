import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { aiSubscriptionService } from '../../services/aiSubscriptionService';
import { useAuth } from '../../modules/auth/AuthProvider';
import { isProtectedSuperAdmin } from '../../config/roles';
import './AISubscriptions.css';

const isoDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const activeOf = (user) => user.subscriptions.find((item) => item.status === 'Active') || user.subscriptions[0];

export default function AISubscriptions({ selectedUserId, onUserOpened }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [features, setFeatures] = useState([]);
  const [myEntitlements, setMyEntitlements] = useState(null);
  const [editing, setEditing] = useState(null);
  const isSuperAdmin = isProtectedSuperAdmin(currentUser?.username) || currentUser?.role === 'Super Administrator';

  const load = useCallback((signal) => Promise.all([
    aiSubscriptionService.adminList(signal),
    aiSubscriptionService.features(signal),
    aiSubscriptionService.entitlements(signal),
  ]).then(([accountData, featureData, entitlementData]) => {
    setUsers(accountData);
    setFeatures(featureData);
    setMyEntitlements(entitlementData);
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((error) => error.name !== 'AbortError' && toast.error(error.message));
    return () => controller.abort();
  }, [load]);

  const assignableFeatures = isSuperAdmin
    ? features
    : features.filter((feature) => myEntitlements?.effective_feature_codes?.includes(feature.feature_code));

  const open = useCallback((account) => {
    const subscription = activeOf(account);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const nextYear = new Date();
    nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
    setEditing({ user: account, subscription, plan_name: subscription?.plan_name || 'AI Research', start_date: isoDate(subscription?.start_date) || isoDate(tomorrow), end_date: isoDate(subscription?.end_date) || isoDate(nextYear), feature_codes: (subscription?.features || []).filter((feature) => feature.is_enabled).map((feature) => feature.feature_code) });
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const selectedAccount = users.find((account) => account.id === selectedUserId);
    if (selectedAccount) { open(selectedAccount); onUserOpened?.(); }
  }, [onUserOpened, open, selectedUserId, users]);

  useEffect(() => {
    if (editing) document.getElementById('ai-subscriptions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  async function save(event) {
    event.preventDefault();
    try {
      let subscription;
      if (editing.subscription) {
        subscription = await aiSubscriptionService.update(editing.subscription.id, { plan_name: editing.plan_name, start_date: `${editing.start_date}T00:00:00Z`, end_date: `${editing.end_date}T23:59:59Z`, status: 'Active' });
        await aiSubscriptionService.setFeatures(subscription.id, editing.feature_codes);
      } else {
        subscription = await aiSubscriptionService.create({ user_id: editing.user.id, plan_name: editing.plan_name, start_date: `${editing.start_date}T00:00:00Z`, end_date: `${editing.end_date}T23:59:59Z`, feature_codes: editing.feature_codes });
      }
      toast.success('AI access saved.');
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (!editing) return null;
  return <section id="ai-subscriptions" className="ai-subscriptions" aria-label="Manage user AI access">
    <form className="ai-subscription-editor" onSubmit={save}>
      <header><div><h4>{editing.subscription ? 'Manage AI access' : 'Grant AI access'}</h4><p>{editing.user.display_name} · {editing.user.username}</p></div><button type="button" className="btn-control-secondary" onClick={() => setEditing(null)}>Close</button></header>
      <div className="ai-subscription-editor__fields"><label>Plan name<input required maxLength={120} value={editing.plan_name} onChange={(event) => setEditing({ ...editing, plan_name: event.target.value })} /></label><label>Start date<input required type="date" value={editing.start_date} onChange={(event) => setEditing({ ...editing, start_date: event.target.value })} /></label><label>Expiration date<input required type="date" value={editing.end_date} onChange={(event) => setEditing({ ...editing, end_date: event.target.value })} /></label></div>
      <fieldset><legend>Included AI features</legend>{assignableFeatures.length === 0 ? <p className="ai-subscription-editor__empty">No AI features are included in your active administrator subscription. Contact a Super Administrator to purchase AI feature entitlements.</p> : assignableFeatures.map((feature) => <label key={feature.feature_code}><input type="checkbox" checked={editing.feature_codes.includes(feature.feature_code)} onChange={(event) => setEditing({ ...editing, feature_codes: event.target.checked ? [...editing.feature_codes, feature.feature_code] : editing.feature_codes.filter((code) => code !== feature.feature_code) })} /><span><strong>{feature.feature_name}</strong><small>{feature.is_implemented ? 'Implemented' : 'Coming Soon — may be preassigned'}</small></span></label>)}</fieldset>
      <button className="btn-primary" disabled={assignableFeatures.length === 0 && editing.feature_codes.length === 0}>Save AI access</button>
    </form>
  </section>;
}
