const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || '';

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, '');
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Pathology Workspace';
