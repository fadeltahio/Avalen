// Visual viewport follows the mobile keyboard without React rerenders per frame.
export function watchViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const root = document.documentElement;
  let frame;
  function sync() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.style.setProperty('--avalen-viewport-height', `${viewport.height}px`);
      root.style.setProperty('--avalen-viewport-top', `${viewport.offsetTop}px`);
      const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      root.dataset.keyboard = editing && viewport.scale === 1 && innerHeight - viewport.height > 120 ? 'open' : 'closed';
    });
  }
  for (const event of ['resize', 'scroll']) viewport.addEventListener(event, sync, {passive:true});
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', sync);
  window.addEventListener('resize', sync, {passive:true});
  sync();
  return () => {
    cancelAnimationFrame(frame);
    for (const event of ['resize', 'scroll']) viewport.removeEventListener(event, sync);
    document.removeEventListener('focusin', sync);
    document.removeEventListener('focusout', sync);
    window.removeEventListener('resize', sync);
    root.style.removeProperty('--avalen-viewport-height'); root.style.removeProperty('--avalen-viewport-top'); delete root.dataset.keyboard;
  };
}
