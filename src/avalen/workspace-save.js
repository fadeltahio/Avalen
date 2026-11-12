import {useRef, useState} from 'react';
import {useApp} from './context.js';

// Keep a form open, with its values intact, until persistence acknowledges it.
export function useWorkspaceSave() {
  const {update} = useApp();
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(mutate) {
    if (lock.current) return false;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await update(mutate);
      if (result?.error) throw new Error(result.error);
      return true;
    } catch (cause) {
      setError(cause.message || 'This change could not be saved. Please try again.');
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return {save, saving, error};
}
