import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { isAdministratorRole, isClinicalReadRole, isIntakeRole } from '../config/roles';

describe('Role-Based Access Control configuration', () => {
  it('correctly verifies System Administrator role privileges', () => {
    expect(isAdministratorRole('System Administrator')).toBe(true);
    expect(isAdministratorRole('Laboratory Manager')).toBe(false);
    expect(isAdministratorRole('Pathologist')).toBe(false);
  });

  it('correctly grants intake roles to Administrator and Laboratory Manager only', () => {
    expect(isIntakeRole('System Administrator')).toBe(true);
    expect(isIntakeRole('Laboratory Manager')).toBe(true);
    expect(isIntakeRole('Pathologist')).toBe(false);
  });

  it('correctly grants clinical read roles to all three standard roles', () => {
    expect(isClinicalReadRole('System Administrator')).toBe(true);
    expect(isClinicalReadRole('Laboratory Manager')).toBe(true);
    expect(isClinicalReadRole('Pathologist')).toBe(true);
    expect(isClinicalReadRole('Guest')).toBe(false);
  });
});

describe('UI Error Boundary component', () => {
  it('renders fallback title when a child component throws an error', async () => {
    const ErrorBoundary = (await import('../components/ErrorBoundary/ErrorBoundary')).default;
    
    function FaultyComponent() {
      throw new Error('Test crash');
    }

    // Suppress console.error for expected test crash
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary title="Workspace Error Fallback">
        <FaultyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Workspace Error Fallback')).toBeInTheDocument();
    spy.mockRestore();
  });
});
