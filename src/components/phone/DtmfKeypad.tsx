import React from 'react';
import { Delete } from 'lucide-react';

/**
 * In-call DTMF keypad. Presentational only: every keypress is sent to the
 * live call by the parent (LocalParticipant.publishDtmf) — this grid
 * never pretends a keypress worked. `sentDigits` is the record of digits
 * already sent this call; Clear only clears that record, it cannot unsend
 * a digit that already went out.
 */

const KEYS: { digit: string; letters: string }[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

interface DtmfKeypadProps {
  /** Digits already sent on this call, shown as a record. */
  sentDigits: string;
  /** Called with the digit when a key is pressed. */
  onDigit: (digit: string) => void;
  /** Clears the sent-digits record (does not unsend anything). */
  onClear: () => void;
  disabled?: boolean;
}

export const DtmfKeypad: React.FC<DtmfKeypadProps> = ({
  sentDigits,
  onDigit,
  onClear,
  disabled,
}) => {
  return (
    <div className="pt-3 border-t border-zinc-800 space-y-2">
      {/* Sent-digits record */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tracking-widest overflow-x-auto whitespace-nowrap">
          {sentDigits || <span className="text-zinc-600 tracking-normal">Digits sent will show here</span>}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !sentDigits}
          aria-label="Clear sent digits"
          title="Clear the record of digits sent"
          className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-40 transition cursor-pointer active:scale-95 flex items-center justify-center"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* Keys — 48dp minimum touch targets, 12px minimum text */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(({ digit, letters }) => (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            disabled={disabled}
            aria-label={`Dial ${digit}`}
            className="min-h-[56px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700 disabled:opacity-40 transition cursor-pointer active:scale-95 flex flex-col items-center justify-center"
          >
            <span className="text-xl font-bold text-white leading-none">{digit}</span>
            {letters && (
              <span className="text-xs text-zinc-400 font-bold tracking-widest mt-0.5">{letters}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500 text-center">
        Digits are sent as you press them — use this for menus (“press 1”), extensions, and PINs.
      </p>
    </div>
  );
};
