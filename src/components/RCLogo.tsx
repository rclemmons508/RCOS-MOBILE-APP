import React from 'react';

interface RCLogoProps {
  variant?: 'compact' | 'full' | 'hero';
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const RCLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg 
    viewBox="0 0 280 120" 
    className={`inline-block shrink-0 ${className}`} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Letter R (Stark White) */}
    <path 
      d="M 12 42           L 42 12           L 122 12           C 146 12 158 24 158 45           C 158 64 145 74 122 76           L 156 112           L 120 112           L 92 76           L 52 76           L 52 112           L 16 112           Z           M 52 36           L 110 36           C 120 36 124 40 124 46           C 124 52 120 56 110 56           L 52 56           Z" 
      fill="#FFFFFF" 
    />
    {/* Diagonal Accent Slash (Neon Lime Green) */}
    <path d="M 106 86 L 130 112 L 115 112 L 91 86 Z" fill="#84CC16" />
    {/* Letter C (Neon Lime Green) */}
    <path 
      d="M 230 12           L 262 42           L 218 42           C 190 42 182 52 182 62           C 182 72 190 82 218 82           L 252 82           L 222 112           L 172 112           C 142 112 132 90 132 62           C 132 34 142 12 172 12           Z" 
      fill="#84CC16" 
    />
  </svg>
);

export const RCLogo: React.FC<RCLogoProps> = ({
  variant = 'compact',
  className = '',
  showTagline = false,
  size,
  showText = true,
}) => {
  if (size && !variant) {
    variant = size === 'xl' || size === 'lg' ? 'hero' : 'compact';
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <RCLogoIcon className="h-7 w-auto" />
        {showText && (
          <div className="flex flex-col leading-none">
            <span className="font-black text-xs tracking-[0.2em] text-white">RC</span>
            <span className="text-[7.5px] font-extrabold tracking-[0.25em] text-lime-400">SOLUTIONS</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="flex items-center gap-3">
          <RCLogoIcon className="h-12 w-auto" />
          {showText && (
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-[0.3em] text-white leading-none">RC</span>
              <span className="text-[10px] font-black tracking-[0.4em] text-lime-400 mt-0.5">SOLUTIONS</span>
            </div>
          )}
        </div>
        {showTagline && (
          <div className="w-full flex items-center justify-center gap-3 mt-3 opacity-90">
            <div className="h-[1px] flex-1 bg-zinc-800" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-lime-400 whitespace-nowrap">
              AUTOMATE. OPTIMIZE. GROW.
            </span>
            <div className="h-[1px] flex-1 bg-zinc-800" />
          </div>
        )}
      </div>
    );
  }

  // Hero Card Variant
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 shadow-xl select-none ${className}`}>
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="my-1.5 p-3 rounded-2xl bg-black/80 border border-zinc-800 shadow-lg">
          <RCLogoIcon className="h-14 w-auto" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black tracking-[0.35em] text-white mt-2">
          RC SOLUTIONS
        </h1>
        <div className="w-full flex items-center justify-center gap-2 my-3 opacity-90">
          <div className="h-[1px] w-8 sm:w-12 bg-zinc-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-lime-500" />
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.2em] text-lime-400 whitespace-nowrap">
            AUTOMATE. OPTIMIZE. GROW.
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-lime-500" />
          <div className="h-[1px] w-8 sm:w-12 bg-zinc-800" />
        </div>
        <div className="pt-2.5 border-t border-zinc-800/80 w-full flex items-center justify-center gap-2">
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-zinc-400">
            YOUR AI-POWERED BUSINESS PARTNER
          </span>
        </div>
      </div>
    </div>
  );
};

// Aliases for backwards compatibility
export const RcLogo = RCLogo;
export default RCLogo;
