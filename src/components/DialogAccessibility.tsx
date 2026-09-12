import { useEffect } from 'react';

/** Covers sheets, search and nested confirmation dialogs with one focus owner. */
export function DialogAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    const focusable = () => active ? [...active.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length) : [];
    const sync = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const next = dialogs[dialogs.length - 1] ?? null;
      if (next === active) return;
      if (!active && next) previous = document.activeElement as HTMLElement;
      active = next;
      document.body.style.overflow = next ? 'hidden' : '';
      document.querySelectorAll<HTMLElement>('.main, .sidebar, .bottom-nav').forEach((el) => { el.inert = !!next && !el.contains(next); });
      if (next && !next.contains(document.activeElement)) (focusable()[0] ?? next).focus();
      if (!next && previous?.isConnected) previous.focus();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => {
      if (!active || event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; document.querySelectorAll<HTMLElement>('[inert]').forEach((el) => { el.inert = false; }); };
  }, []);
  return null;
}
