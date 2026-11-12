// Paint the current design before React, then respect saved appearance.
try {
  const workspace = JSON.parse(localStorage.getItem('avalen.workspace.v1') || 'null');
  document.documentElement.dataset.theme = workspace?.settings?.designVersion === 'editorial-v1' && workspace.settings.theme === 'light' ? 'light' : 'dark';
} catch { document.documentElement.dataset.theme = 'dark'; }
