import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getDeviceHeaders,
  getDeviceLocation,
  getDeviceName,
  setDeviceLocation,
  setDeviceName,
} from './deviceService';

describe('deviceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides default device location and device name', () => {
    const location = getDeviceLocation();
    const name = getDeviceName();

    expect(typeof location).toBe('string');
    expect(location.length).toBeGreaterThan(0);
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('stores and retrieves custom device location and name', () => {
    setDeviceLocation('Pathology Lab 1 - Grossing Station');
    setDeviceName('Pathology-WS-04');

    expect(getDeviceLocation()).toBe('Pathology Lab 1 - Grossing Station');
    expect(getDeviceName()).toBe('Pathology-WS-04');

    const headers = getDeviceHeaders();
    expect(headers['X-Device-Location']).toBe('Pathology Lab 1 - Grossing Station');
    expect(headers['X-Device-Name']).toBe('Pathology-WS-04');
  });

  it('clears custom location and falls back to default when empty string passed', () => {
    setDeviceLocation('Temporary Room');
    expect(getDeviceLocation()).toBe('Temporary Room');

    setDeviceLocation('');
    expect(getDeviceLocation()).not.toBe('Temporary Room');
  });
});
