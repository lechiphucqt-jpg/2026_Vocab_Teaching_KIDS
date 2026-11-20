import { useState } from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';

interface BrandMarkProps {
  logoDataUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({ logoDataUrl, size = 'md' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-7 h-7 rounded-full'
      : size === 'lg'
        ? 'w-14 h-14 rounded-full'
        : 'w-10 h-10 rounded-full';

  if (logoDataUrl && !failed) {
    return (
      <div
        className={`${dims} shrink-0 overflow-hidden bg-white border border-emerald-200 flex items-center justify-center shadow-2xs`}
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
      className={`${dims} shrink-0 bg-gradient-to-tr from-[#15803d] to-[#10b981] border border-emerald-300 text-white flex items-center justify-center font-display font-bold tracking-tight shadow-2xs`}
      aria-hidden="true"
    >
      {size === 'sm' ? (
        <BookOpen className="w-3.5 h-3.5" />
      ) : size === 'lg' ? (
        <GraduationCap className="w-7 h-7" />
      ) : (
        <GraduationCap className="w-5 h-5 text-white" />
      )}
    </div>
  );
}
