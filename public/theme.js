// Paint the current design before React, then respect saved appearance.
try {
  const workspace = JSON.parse(localStorage.getItem('avalen.workspace.v1') || 'null');
  document.documentElement.dataset.theme = workspace?.settings?.designVersion === 'editorial-v1' && workspace.settings.theme === 'light' ? 'light' : 'dark';
} catch { document.documentElement.dataset.theme = 'dark'; }

// Language and reading direction before the first paint (see src/avalen/i18n.js).
try {
  const saved = localStorage.getItem('avalen.language');
  const lang = saved === 'ar' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
} catch {}
