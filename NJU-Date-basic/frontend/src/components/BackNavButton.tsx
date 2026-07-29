import React from 'react';
import MaterialIcon from './MaterialIcon';

interface BackNavButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

const BASE_CLASS_NAME = [
  'group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full border border-[#EAE7E1]',
  'bg-[#FCFBF8] px-4 text-[#8B7355] shadow-[0_2px_8px_rgba(44,40,37,0.06)] transition-all duration-300',
  'hover:-translate-y-0.5 hover:border-[#8B7355]/35 hover:bg-gradient-to-r hover:from-[#FCFBF8] hover:to-[#F3EEE8]',
  'hover:text-[#2C2825] hover:shadow-[0_8px_18px_rgba(44,40,37,0.1)]',
].join(' ');

export default function BackNavButton({ label, onClick, className = '' }: BackNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BASE_CLASS_NAME} ${className}`.trim()}
    >
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-[#8B7355]/8 via-transparent to-[#420047]/8" />
      <MaterialIcon name="west" className="relative z-10 text-[18px] transition-transform group-hover:-translate-x-1" />
      <span className="relative z-10 font-serif text-sm tracking-widest">{label}</span>
    </button>
  );
}
