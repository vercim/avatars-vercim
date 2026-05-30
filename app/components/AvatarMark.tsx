interface AvatarMarkProps {
  className?: string;
}

/**
 * The avatars.verc.im brand mark (public/avatar.svg) inlined so it inherits the
 * current text color, keeping it monochromatic in both themes.
 */
export default function AvatarMark({ className }: AvatarMarkProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={['avatar-mark', className].filter(Boolean).join(' ')}
    >
      <path d="M11 3C11 3.48237 10.8862 3.93815 10.6839 4.34193L16 7V10H12.5L15 15V16H10L8 12L6 16H1V15L3.5 10H0V7L5.31613 4.34193C5.11384 3.93815 5 3.48237 5 3C5 1.34315 6.34315 0 8 0C9.65685 0 11 1.34315 11 3Z" />
    </svg>
  );
}
