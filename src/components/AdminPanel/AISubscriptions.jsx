import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BrainCircuit, RefreshCw } from 'lucide-react';
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
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const nextYear = new Date(); nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
    setEditing({ user: account, subscription, plan_name: subscription?.plan_name || 'AI Research', start_date: isoDate(subscription?.start_date) || isoDate(tomorrow), end_date: isoDate(subscription?.end_date) || isoDate(nextYear), feature_codes: (subscription?.features || []).filter((f) => f.is_enabled).map((f) => f.feature_code) });
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

}
