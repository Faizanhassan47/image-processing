export const CLINICAL_DATA_CHANGED = 'clinical:data-changed';

export function notifyClinicalDataChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(CLINICAL_DATA_CHANGED, { detail }));
}

export function subscribeToClinicalDataChanges(listener) {
  window.addEventListener(CLINICAL_DATA_CHANGED, listener);
  return () => window.removeEventListener(CLINICAL_DATA_CHANGED, listener);
}
