import {
  BookOpen,
  Briefcase,
  Code,
  Dumbbell,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Inbox,
  Music,
  Palette,
  Plane,
  ShoppingCart,
  Star,
  type LucideIcon,
} from 'lucide-react';

export const LIST_ICON_MAP: Record<string, LucideIcon> = {
  inbox: Inbox,
  briefcase: Briefcase,
  home: Home,
  'book-open': BookOpen,
  'shopping-cart': ShoppingCart,
  heart: Heart,
  star: Star,
  code: Code,
  'graduation-cap': GraduationCap,
  plane: Plane,
  dumbbell: Dumbbell,
  music: Music,
  palette: Palette,
  gift: Gift,
};

export function ListIcon({
  name,
  size = 18,
  className,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const C = LIST_ICON_MAP[name] ?? Inbox;
  return <C size={size} className={className} strokeWidth={strokeWidth} />;
}

/** 应用 logo:渐变圆角方块 + 对勾 */
export function AppLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="22" fill="url(#logo-g)" />
      <path
        d="M28 51.5 L43 66.5 L73 36"
        fill="none"
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
