import { useEffect } from 'react';

export default function useUnsavedChanges(isDirty) {
  useEffect(() => {
    const warn = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
}
