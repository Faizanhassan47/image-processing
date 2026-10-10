import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('focuses the requested field and closes with Escape', async () => {
    const onClose = vi.fn();
    const inputRef = createRef();
    render(<Modal open title="Reset password" onClose={onClose} initialFocusRef={inputRef} footer={<button>Save</button>}>
      <input ref={inputRef} aria-label="New password" />
    </Modal>);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Reset password');
    await waitFor(() => expect(inputRef.current).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps tab focus inside the dialog', () => {
    render(<Modal open title="Confirm" onClose={() => {}} footer={<button>Confirm</button>}><button>First</button></Modal>);
    const buttons = screen.getAllByRole('button');
    buttons.at(-1).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toHaveAttribute('aria-label', 'Close dialog');
  });
});
