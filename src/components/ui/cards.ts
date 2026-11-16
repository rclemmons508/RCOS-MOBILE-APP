/**
 * Shared card + section styling so the Dashboard, the hub switchers, and
 * the new "What needs you" strip look like one app instead of several.
 * One source for the values — change them here, everywhere follows.
 * Visuals match what these screens already used (dark card, subtle
 * border); this unifies them, it does not restyle the app.
 */

/** Standard dark card: Dashboard sections, hub switchers, scenario strip. */
export const dashboardCard = 'rounded-2xl bg-zinc-950 border border-zinc-800/80';

/** Small uppercase section label used above Dashboard sections. */
export const sectionLabel = 'text-xs font-bold text-zinc-500 uppercase tracking-wider';

/** Hub switcher bar (Jobs hub + Messages hub share this exactly). */
export const hubSwitcherContainer = 'flex gap-1 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80';

/** Hub switcher tab button — active tab is solid brand green, the rest quiet. */
export const hubSwitcherButton = (isActive: boolean): string =>
  `flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[48px] ${
    isActive
      ? 'bg-[#22ec72] text-black'
      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
  }`;

/**
 * Sidebar-design tokens (Stage 1 of the sidebar rebuild). Colors sampled
 * from the reference image: near-black green-tinted background, dark
 * green-tinted cards, and the reference's bright green accent.
 * Stage 7 unified the whole app on this one accent (#22ec72) — the old
 * lime/emerald greens are gone; do not reintroduce a second green.
 */
/** Page/card background for sidebar-design surfaces. */
export const sidebarCard = 'rounded-2xl bg-[#0c1211] border border-[#1d2b26]';
/** Bright green accent sampled from the reference's solid green buttons. */
export const sidebarAccentHex = '#22ec72';
/** Active drawer row / active pill: accent tint on the card background. */
export const sidebarActiveTint = 'bg-[#22ec72]/15 text-[#22ec72] border border-[#22ec72]/30';
