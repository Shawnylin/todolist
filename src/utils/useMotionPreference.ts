import { useSyncExternalStore } from 'react';
const query = '(prefers-reduced-motion: reduce)';
const snapshot = () => window.matchMedia(query).matches;
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
/** Also responds when the preference changes while the app is open. */
export const useMotionPreference = () => useSyncExternalStore(subscribe, snapshot, () => false);
