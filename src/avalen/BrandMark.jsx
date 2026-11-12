import React from 'react';

// Its styles live in index.html, so the mark can draw itself before the app has loaded.
const CYCLE = 1200, DRAWN = 1000;

export function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" transform="rotate(-60 50 50)"/><path d="M29.5 72 50 33 70.5 72"/></svg>;
}

// Time left until the opening mark is fully drawn, so it never leaves half finished.
export function bootWait() {
  const elapsed = document.querySelector('#boot circle')?.getAnimations()[0]?.currentTime;
  if (elapsed == null) return 0;
  const left = (DRAWN - (elapsed % CYCLE) + CYCLE) % CYCLE;
  return left < 120 ? left + CYCLE : left;
}

// Launch only: the drawn mark settles and the name opens out of it.
export function nameBoot() {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('is-leaving')) return false;
  boot.classList.add('is-naming');
  return true;
}

export function leaveBoot() {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('is-leaving')) return;
  boot.classList.add('is-leaving');
  setTimeout(() => boot.remove(), 400);
}
