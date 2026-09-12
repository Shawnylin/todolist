import { useEffect } from 'react';

/** Detect a software keyboard from the visual viewport, not merely input focus. */
export function Viewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let baseline = window.innerHeight;
    let frame = 0;
    const update = () => {
      const editable = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      const height = viewport?.height ?? window.innerHeight;
      if (!editable) baseline = Math.max(height, window.innerHeight);
      const keyboard = !!editable && (viewport?.scale ?? 1) < 1.1 && baseline - height > 120;
      document.documentElement.dataset.keyboardOpen = String(keyboard);
      document.documentElement.style.setProperty('--visual-height', `${height}px`);
      document.documentElement.style.setProperty('--visual-top', `${viewport?.offsetTop ?? 0}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const orient = () => {
      baseline = window.innerHeight;
      schedule();
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', orient);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', orient);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
