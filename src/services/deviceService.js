const DEVICE_LOCATION_KEY = 'prs_device_location';
const DEVICE_NAME_KEY = 'prs_device_name';

export function getDefaultLocation() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? `Local (${tz})` : 'Local Workstation';
  } catch {
    return 'Local Workstation';
  }
}

export function getDefaultDeviceName() {
  if (typeof navigator !== 'undefined') {
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    if (platform) return `${platform} Workstation`;
  }
  return 'Workstation';
}

export function getDeviceLocation() {
  if (typeof localStorage === 'undefined') return getDefaultLocation();
  const saved = localStorage.getItem(DEVICE_LOCATION_KEY);
  return saved && saved.trim() ? saved.trim() : getDefaultLocation();
}

export function setDeviceLocation(location) {
  if (typeof localStorage === 'undefined') return;
  const trimmed = (location || '').trim();
  if (trimmed) {
    localStorage.setItem(DEVICE_LOCATION_KEY, trimmed);
  } else {
    localStorage.removeItem(DEVICE_LOCATION_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prs:device-info-changed'));
  }
}

export function getDeviceName() {
  if (typeof localStorage === 'undefined') return getDefaultDeviceName();
  const saved = localStorage.getItem(DEVICE_NAME_KEY);
  return saved && saved.trim() ? saved.trim() : getDefaultDeviceName();
}

export function setDeviceName(name) {
  if (typeof localStorage === 'undefined') return;
  const trimmed = (name || '').trim();
  if (trimmed) {
    localStorage.setItem(DEVICE_NAME_KEY, trimmed);
  } else {
    localStorage.removeItem(DEVICE_NAME_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prs:device-info-changed'));
  }
}

export function getDeviceHeaders() {
  return {
    'X-Device-Location': getDeviceLocation(),
    'X-Device-Name': getDeviceName(),
  };
}

export function detectGeolocation(onSuccess) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lon = pos.coords.longitude.toFixed(4);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const formatted = tz ? `${lat}, ${lon} (${tz})` : `${lat}, ${lon}`;
      if (typeof onSuccess === 'function') {
        onSuccess(formatted);
      }
    },
    () => {
      // Ignore errors / user denied permission gracefully
    },
    { timeout: 8000, maximumAge: 600000 }
  );
}
