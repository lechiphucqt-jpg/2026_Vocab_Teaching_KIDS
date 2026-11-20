import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BrandMarkProps {
  logoDataUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({ logoDataUrl, size = 'md' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-7 h-7 rounded-md'
      : size === 'lg'
        ? 'w-14 h-14 rounded-xl'
        : 'w-9 h-9 rounded-lg';

  if (logoDataUrl && !failed) {
    return (
      <div
        className={`${dims} shrink-0 overflow-hidden bg-white border border-slate-200 flex items-center justify-center`}
      >
        <img
          src={logoDataUrl}
          alt="Logo Tiếng Anh Thầy Phúc"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain p-0.5"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} shrink-0 bg-[#0284C7] text-white flex items-center justify-center font-display font-bold tracking-tight`}
      aria-hidden="true"
    >
      {size === 'sm' ? (
        <BookOpen className="w-4 h-4" />
      ) : size === 'lg' ? (
        <span className="text-xl">TP</span>
      ) : (
        <span className="text-sm">TP</span>
      )}
    </div>
  );
}
