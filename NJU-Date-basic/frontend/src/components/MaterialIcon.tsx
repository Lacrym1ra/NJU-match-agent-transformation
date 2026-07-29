import React from 'react';

interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string | null;
  title?: string;
}

const ICON_ALIASES: Record<string, string> = {
  academic: 'local_library',
  art: 'palette',
  arts: 'palette',
  career: 'badge',
  game: 'sports_esports',
  life: 'park',
  lifestyle: 'directions_run',
  music: 'music_note',
  professional: 'badge',
  sports: 'directions_run',
  study: 'local_library',
  tech: 'code',
};

export default function MaterialIcon({ name, className = '', title, children, ...props }: MaterialIconProps) {
  const iconName = String(name ?? children ?? '').trim();
  const resolvedName = ICON_ALIASES[iconName] ?? iconName;

  return (
    <span
      aria-hidden={title ? undefined : true}
      className={`material-symbols-outlined ${className}`}
      role={title ? 'img' : undefined}
      title={title}
      {...props}
    >
      {resolvedName || 'auto_awesome'}
    </span>
  );
}
