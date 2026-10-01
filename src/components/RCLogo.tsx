import React from 'react';

interface RCLogoProps {
  variant?: 'compact' | 'full' | 'hero';
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const RCLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <div className={`relative shrink-0 overflow-hidden rounded-xl bg-black border border-lime-500/30 shadow-md flex items-center justify-center ${className}`}>
    <img 
      src="/app-icon.png" 
      alt="RC Solutions App Icon" 
      className="w-full h-full object-cover object-center select-none"
      loading="eager"
    />
  </div>
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
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <RCLogoIcon className="h-8 w-8" />
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
          <RCLogoIcon className="h-14 w-14 rounded-2xl border-lime-500/50 shadow-lg shadow-lime-500/20" />
          {showText && (
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-[0.3em] text-white leading-none">RC</span>
              <span className="text-[10px] font-black tracking-[0.4em] text-lime-400 mt-1">SOLUTIONS</span>
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
    <div className={`relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800/80 p-6 shadow-2xl select-none ${className}`}>
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="my-2 p-1 rounded-3xl bg-black border border-lime-500/40 shadow-xl shadow-lime-500/10">
          <RCLogoIcon className="h-20 w-20 rounded-2xl" />
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
