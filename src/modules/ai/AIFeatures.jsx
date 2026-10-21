import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Microscope, Search, ShieldCheck, SlidersHorizontal, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { aiSubscriptionService } from '../../services/aiSubscriptionService';
import { modelListing } from './aiListing';
import './AIFeatures.css';

function accessState(feature, subscription) {
  if (!feature.is_implemented) return { key: 'soon', label: 'Coming soon', message: 'The model is listed for planning but cannot run yet.' };
  if (!feature.is_active) return { key: 'disabled', label: 'Disabled', message: 'This model is currently unavailable across the platform.' };
  if (feature.is_entitled) return { key: 'available', label: 'Available to you', message: 'Your account is licensed to use this model.' };
  if (subscription?.status === 'Expired') return { key: 'expired', label: 'Subscription expired', message: 'Ask your administrator to renew access.' };
  if (subscription?.status === 'Suspended') return { key: 'suspended', label: 'Subscription suspended', message: 'Access is temporarily suspended.' };
  return { key: 'required', label: 'Access required', message: 'Request a model seat from your laboratory administrator.' };
}

export default function AIFeatures() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All models');
  const [updatingPreferenceId, setUpdatingPreferenceId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    aiSubscriptionService.entitlements(controller.signal)
      .then((result) => { setData(result); setError(''); })
      .catch((requestError) => requestError.name !== 'AbortError' && setError(requestError.message));
    return () => controller.abort();
  }, []);

  const models = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.features || []).filter((feature) => {
      if (!feature.catalog_title || feature.is_catalog_visible === false || feature.is_catalog_visible === 0 || feature.is_catalog_deleted === true || feature.is_catalog_deleted === 1) return false;
      const detail = modelListing(feature);
      const state = accessState(feature, data?.subscription);
      const matchesQuery = !normalizedQuery || `${feature.feature_name} ${detail.category} ${detail.summary} ${detail.purpose}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === 'All models'
        || (filter === 'Available' && state.key === 'available')
        || (filter === 'Coming soon' && state.key === 'soon')
        || (filter === 'Needs access' && ['required', 'expired', 'suspended'].includes(state.key));
      return matchesQuery && matchesFilter;
    });
  }, [data, filter, query]);

  const visibleFeatures = (data?.features || []).filter((feature) => feature.catalog_title && feature.is_catalog_visible !== false && feature.is_catalog_visible !== 0 && feature.is_catalog_deleted !== true && feature.is_catalog_deleted !== 1);
  const availableCount = visibleFeatures.filter((feature) => accessState(feature, data?.subscription).key === 'available').length;
  const comingSoonCount = visibleFeatures.filter((feature) => !feature.is_implemented).length;

  async function updatePreference(feature, isEnabled) {
    setUpdatingPreferenceId(feature.id);
    try {
      setData(await aiSubscriptionService.setMyFeaturePreference(feature.id, isEnabled));
      setError('');
      toast.success(`${feature.feature_name} ${isEnabled ? 'added to' : 'removed from'} your workspace`);
    } catch (updateError) {
      const message = updateError.message || 'Could not update your model preference';
      setError(message);
      toast.error(message);
    } finally {
      setUpdatingPreferenceId(null);
    }
  }

  return <main className="ai-store" id="main-content">
    <header className="ai-store__header">
      <div className="ai-store__heading">
        <p className="page-eyebrow">Clinical AI catalog</p>
        <h1>AI Model Store</h1>
        <p>Explore governed decision-support models, understand their purpose, and see which capabilities are available to your account.</p>
      </div>
      <Link to="/" className="btn-control-secondary route-link">Back to workspace</Link>
    </header>

    <section className="ai-store__overview" aria-label="AI catalog summary">
      <div><Microscope size={20} /><span><strong>{visibleFeatures.length}</strong> models in catalog</span></div>
      <div><UserRoundCheck size={20} /><span><strong>{availableCount}</strong> available to you</span></div>
      <div><Clock3 size={20} /><span><strong>{comingSoonCount}</strong> in development</span></div>
    </section>

    <aside className="ai-store__notice">
      <ShieldCheck size={20} />
      <div><strong>Designed to support, not replace, professional diagnosis</strong><p>AI findings must be reviewed alongside the slide, case history, and other clinical evidence by an authorized pathology professional.</p></div>
    </aside>

    <section className="ai-store__toolbar" aria-label="Filter AI models">
      <label className="ai-store__search"><Search size={17} /><span className="sr-only">Search AI models</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models or clinical purpose" /></label>
      <label className="ai-store__filter"><SlidersHorizontal size={16} /><span className="sr-only">Filter AI models</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All models</option><option>Available</option><option>Coming soon</option><option>Needs access</option></select></label>
    </section>

    {error && <div className="ai-store__error" role="alert"><strong>AI catalog could not be updated.</strong><span>{error}</span></div>}
    {!data && !error && <div className="ai-store__loading"><span className="loading-spinner" /> Loading the AI model catalog…</div>}

    {data && <section className="ai-store__grid" aria-label="AI model catalog">
      {models.map((feature) => {
        const detail = modelListing(feature);
        const Icon = detail.icon;
        const state = accessState(feature, data.subscription);
        const isAvailable = state.key === 'available';
        const canChoose = Boolean(feature.is_entitled && feature.is_active && feature.is_implemented);
        return <article className={`ai-model-card${detail.featured ? ' ai-model-card--featured' : ''}`} key={feature.feature_code}>
          <div className="ai-model-card__header">
            <span className="ai-model-card__icon"><Icon size={24} /></span>
            <div className="ai-model-card__identity"><span>{detail.category}</span><h2>{detail.title}</h2><p>{detail.summary}</p></div>
            <span className={`ai-model-state ai-model-state--${state.key}`}>{state.label}</span>
          </div>
          <div className="ai-model-card__content"><section><h3>Clinical purpose</h3><p>{detail.purpose}</p></section><section><h3>Clinical value</h3><p>{detail.value}</p></section></div>
          <div className="ai-model-card__outputs"><span>Capabilities</span><ul>{detail.outputs.map((output) => <li key={output}><Check size={13} />{output}</li>)}</ul></div>
          <footer className="ai-model-card__footer"><div className="ai-model-card__access"><span className={`ai-model-card__access-dot ai-model-card__access-dot--${state.key}`} /><p><strong>{state.label}</strong><small>{state.message}</small></p></div><div className="ai-model-card__actions">{feature.catalog_session_price_usd != null && <span className="ai-model-card__price">Per session <strong>USD {Number(feature.catalog_session_price_usd).toFixed(2)}</strong><small>PKR {Number(feature.catalog_session_price_pkr).toLocaleString(undefined, { maximumFractionDigits: 2 })}</small></span>}{!isAvailable && <button type="button" className="ai-model-card__primary" disabled>{state.key === 'soon' ? 'Not yet available' : state.key === 'disabled' ? 'Disabled' : 'Access required'}</button>}{canChoose && <label className="ai-model-preference"><span>Use in workspace</span><input type="checkbox" checked={Boolean(feature.user_enabled)} disabled={updatingPreferenceId === feature.id} onChange={(event) => updatePreference(feature, event.target.checked)} /><span className="ai-switch" aria-hidden="true" /></label>}</div></footer>
        </article>;
      })}
      {!models.length && <div className="ai-store__empty"><Search size={24} /><h2>No matching models</h2><p>Try a different search phrase or availability filter.</p><button type="button" className="btn-control-secondary" onClick={() => { setQuery(''); setFilter('All models'); }}>Clear filters</button></div>}
    </section>}
  </main>;
}
