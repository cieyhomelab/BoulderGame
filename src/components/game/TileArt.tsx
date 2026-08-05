/**
 * `.` is Dirt — solid, diggable, and a support for boulders.
 * `" "` is open space — walkable, supports nothing. It is what digging leaves behind.
 *
 * `p` and `t` are the two render-time overlays: `parseLevel` resolves both away to open space and
 * the Miner and the Skarbek are drawn from their positions in state, not from the board.
 */
export type Tile = "." | " " | "#" | "g" | "p" | "r" | "e" | "h" | "t";

const DIRT_SPECKS = [
  { cx: 13.5, cy: 16.5, rx: 3.5, ry: 2.5, fill: "#1f2a19" },
  { cx: 40.5, cy: 12, rx: 2.5, ry: 2, fill: "#46583c" },
  { cx: 26.5, cy: 43, rx: 4.5, ry: 3, fill: "#1f2a19" },
  { cx: 51, cy: 46, rx: 3, ry: 2, fill: "#46583c" },
  { cx: 32, cy: 27.5, rx: 2, ry: 1.5, fill: "#46583c" },
] as const;

const EXIT_BAR_XS = [15, 29.5, 44] as const;

const WALL_SEAMS = [
  { x: 30, y: 5, width: 3, height: 24 },
  { x: 14, y: 32, width: 3, height: 22 },
  { x: 46, y: 32, width: 3, height: 22 },
] as const;

/**
 * Gradients and glow filters are declared once per page and referenced by every
 * tile, so the board renders 96 cells without duplicating a def per cell.
 */
export function TileDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <linearGradient id="bg-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4d35" />
          <stop offset="1" stopColor="#28331f" />
        </linearGradient>
        <linearGradient id="bg-open" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0f0a" />
          <stop offset="1" stopColor="#131810" />
        </linearGradient>
        <linearGradient id="bg-gem" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#c8fff5" />
          <stop offset="0.5" stopColor="#79eada" />
          <stop offset="1" stopColor="#12706a" />
        </linearGradient>
        <radialGradient id="bg-rock" cx="0.35" cy="0.28" r="0.75">
          <stop offset="0" stopColor="#bdb5a7" />
          <stop offset="0.55" stopColor="#847d71" />
          <stop offset="1" stopColor="#3e3a33" />
        </radialGradient>
        <linearGradient id="bg-alcove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1712" />
          <stop offset="1" stopColor="#050604" />
        </linearGradient>
        <linearGradient id="bg-hazard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2019" />
          <stop offset="1" stopColor="#1c0f0c" />
        </linearGradient>
        <linearGradient id="bg-spike" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8d2c6" />
          <stop offset="0.6" stopColor="#6b6459" />
          <stop offset="1" stopColor="#2f2b26" />
        </linearGradient>
        <linearGradient id="bg-lava" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff705b" />
          <stop offset="1" stopColor="#b94431" />
        </linearGradient>
        <radialGradient id="bg-portal-core">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#e9d5ff" />
          <stop offset="1" stopColor="#a866ff" />
        </radialGradient>
        <radialGradient id="glow-gem">
          <stop offset="0" stopColor="#79eada" stopOpacity="0.4" />
          <stop offset="1" stopColor="#79eada" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-portal">
          <stop offset="0" stopColor="#a866ff" stopOpacity="0.44" />
          <stop offset="1" stopColor="#a866ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-lamp">
          <stop offset="0" stopColor="#f3b63f" stopOpacity="0.33" />
          <stop offset="1" stopColor="#f3b63f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-ember">
          <stop offset="0" stopColor="#ff705b" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff705b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bg-wraith" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#cfe6ff" />
          <stop offset="0.55" stopColor="#5f86b8" />
          <stop offset="1" stopColor="#1d2d45" />
        </linearGradient>
        <radialGradient id="glow-wraith">
          <stop offset="0" stopColor="#8fd7ff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#8fd7ff" stopOpacity="0" />
        </radialGradient>
        <filter id="fx-gem" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#79eada" floodOpacity="0.63" />
        </filter>
        <filter id="fx-portal" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#a866ff" floodOpacity="0.8" />
        </filter>
        <filter id="fx-lamp" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffe08f" floodOpacity="0.87" />
        </filter>
        <filter id="fx-lava" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#ff705b" floodOpacity="0.67" />
        </filter>
        <filter id="fx-wraith" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#8fd7ff" floodOpacity="0.72" />
        </filter>
      </defs>
    </svg>
  );
}

function DirtGround() {
  return (
    <>
      <rect width="64" height="64" fill="url(#bg-dirt)" />
      {DIRT_SPECKS.map((speck) => (
        <ellipse
          cx={speck.cx}
          cy={speck.cy}
          fill={speck.fill}
          key={`${speck.cx}-${speck.cy}`}
          rx={speck.rx}
          ry={speck.ry}
        />
      ))}
    </>
  );
}

/**
 * A dug-out cavity. Deliberately darker and flatter than `DirtGround` so a carved corridor reads
 * as a hole in the cave; the lit top lip keeps it from looking like an unrendered gap.
 */
function OpenSpace() {
  return (
    <>
      <rect width="64" height="64" fill="url(#bg-open)" />
      <rect width="64" height="4" fill="#232b1d" />
      <rect y="60" width="64" height="4" fill="#050704" />
    </>
  );
}

function Wall() {
  return (
    <>
      <rect width="64" height="64" fill="#6b5540" />
      <rect width="64" height="5" fill="#8f7455" />
      <rect y="54" width="64" height="10" fill="#2f2519" />
      <rect y="29" width="64" height="3" fill="#41321f" />
      {WALL_SEAMS.map((seam) => (
        <rect {...seam} fill="#41321f" key={`${seam.x}-${seam.y}`} />
      ))}
    </>
  );
}

function Boulder() {
  return (
    <>
      <OpenSpace />
      <ellipse cx="32" cy="52" rx="22" ry="6" fill="#000000" fillOpacity="0.4" />
      <ellipse cx="32" cy="31" rx="24" ry="23" fill="url(#bg-rock)" />
      <ellipse cx="25" cy="20.5" rx="8" ry="5.5" fill="#e6e0d4" fillOpacity="0.45" />
      <path
        d="M26 20 L32 32 L26 36 L38 48"
        fill="none"
        stroke="#000000"
        strokeLinecap="round"
        strokeOpacity="0.4"
        strokeWidth="2"
      />
    </>
  );
}

function Gem() {
  return (
    <>
      <DirtGround />
      <circle cx="32" cy="32" r="26" fill="url(#glow-gem)" />
      <path d="M32 8 L50 26 L32 56 L14 26 Z" fill="url(#bg-gem)" filter="url(#fx-gem)" />
      <path d="M32 8 L14 26 L32 26 Z" fill="#e6fffa" fillOpacity="0.5" />
      <path d="M32 26 L50 26 L32 56 Z" fill="#0b5c57" fillOpacity="0.45" />
    </>
  );
}

function Miner() {
  return (
    <>
      {/* The Miner always stands in a tile that has been dug, so the backdrop is open space. */}
      <OpenSpace />
      <circle cx="32" cy="32" r="28" fill="url(#glow-lamp)" />
      <ellipse cx="32" cy="54.5" rx="16" ry="4.5" fill="#000000" fillOpacity="0.44" />
      <rect x="19" y="33" width="26" height="20" rx="7" fill="#d1552f" stroke="#7a2f18" strokeWidth="2" />
      <rect x="19" y="44" width="26" height="4" fill="#7a2f18" />
      <circle cx="32" cy="27" r="8" fill="#f7dcae" />
      <path d="M17 27 L17 24 C17 13 47 13 47 24 L47 27 Z" fill="#f3b63f" />
      <circle cx="34" cy="20" r="4" fill="#fffbe8" filter="url(#fx-lamp)" />
      <rect x="15" y="24" width="34" height="4" rx="2" fill="#c8901f" />
      <ellipse cx="29.5" cy="30" rx="1.5" ry="2" fill="#4a2a14" />
      <ellipse cx="37.5" cy="30" rx="1.5" ry="2" fill="#4a2a14" />
      <rect x="23" y="51" width="6" height="5" fill="#7a2f18" />
      <rect x="35" y="51" width="6" height="5" fill="#7a2f18" />
    </>
  );
}

/** Shared by both Skarbek states, so the sleeping shape and the waking one read as one figure. */
const WRAITH_COWL = "M32 5 C20 5 14 15 16 28 L13 46 C19 43 24 47 32 47 C40 47 45 43 51 46 L48 28 C50 15 44 5 32 5 Z";
/** A spirit has no face, only the dark under the hood. */
const WRAITH_HOLLOW = "M32 12 C24 12 21 19 22 27 L25 34 C27 38 37 38 39 34 L42 27 C43 19 40 12 32 12 Z";
/** Trailing off where legs would be. */
const WRAITH_WISPS = "M17 46 L15 60 M32 47 L32 62 M47 46 L49 60";

/**
 * The Skarbek loosed: a cold hooded wisp carrying a lamp, drifting where his legs would be.
 * Deliberately the Miner's opposite in colour — amber and solid against blue-white and legless —
 * so one glance at a crowded corridor says which figure is which.
 */
function Treasurer() {
  return (
    <>
      {/* He walks dug tunnels only, so the backdrop is always open space. */}
      <OpenSpace />
      <circle cx="32" cy="30" r="29" fill="url(#glow-wraith)" />
      <path d={WRAITH_COWL} fill="url(#bg-wraith)" filter="url(#fx-wraith)" />
      <path d={WRAITH_HOLLOW} fill="#101a2b" />
      <ellipse cx="27" cy="25" rx="3" ry="3.5" fill="#e8fbff" />
      <ellipse cx="37" cy="25" rx="3" ry="3.5" fill="#e8fbff" />
      <path d={WRAITH_WISPS} stroke="#9dc4ee" strokeLinecap="round" strokeOpacity="0.55" strokeWidth="4" />
      <circle cx="32" cy="40" r="4.5" fill="#fffbe8" filter="url(#fx-lamp)" />
    </>
  );
}

/**
 * The Skarbek still sealed in: the same figure with the light out of it. Unglowing on purpose —
 * a player must be able to tell at a glance whether the thing in the niche has woken, and the
 * difference cannot rest on the lamp alone, which a single tile is too small to sell.
 */
function DormantTreasurer() {
  return (
    <>
      <OpenSpace />
      <path d={WRAITH_COWL} fill="#2b3b52" />
      <path d={WRAITH_HOLLOW} fill="#0c1219" />
      {/* Eyes shut to slits: asleep rather than absent. */}
      <rect x="24" y="24" width="6" height="2" rx="1" fill="#5f7592" />
      <rect x="34" y="24" width="6" height="2" rx="1" fill="#5f7592" />
      <path d={WRAITH_WISPS} stroke="#2b3b52" strokeLinecap="round" strokeOpacity="0.45" strokeWidth="4" />
    </>
  );
}

function ExitPortal() {
  return (
    <>
      <rect width="64" height="64" fill="#3d1c6b" />
      <circle cx="32" cy="32" r="30" fill="url(#glow-portal)" />
      <circle cx="32" cy="32" r="21.35" fill="none" stroke="#a866ff" strokeWidth="5.3" filter="url(#fx-portal)" />
      <circle cx="32" cy="32" r="12.45" fill="none" stroke="#c9a0ff" strokeWidth="5.1" />
      <circle cx="32" cy="32" r="8" fill="url(#bg-portal-core)" />
    </>
  );
}

/**
 * The exit before the quota is met: the portal is not lit yet, so the tile shows the bare stone
 * alcove it sits in, sealed behind iron. Deliberately unglowing — the reveal is the whole point.
 */
function LockedExit() {
  return (
    <>
      <rect width="64" height="64" fill="#4a3b2b" />
      <rect width="64" height="5" fill="#6b5540" />
      <rect y="59" width="64" height="5" fill="#2a2016" />
      <path d="M8 59 L8 28 A24 24 0 0 1 56 28 L56 59 Z" fill="url(#bg-alcove)" />
      {EXIT_BAR_XS.map((x) => (
        <g key={x}>
          <rect x={x} y="13" width="5" height="46" fill="#7c7568" />
          <rect x={x + 1} y="13" width="1.5" height="46" fill="#b0a898" fillOpacity="0.55" />
        </g>
      ))}
      <rect x="9" y="32" width="46" height="5" fill="#7c7568" />
      <rect x="9" y="33" width="46" height="1.5" fill="#b0a898" fillOpacity="0.55" />
    </>
  );
}

function Spikes() {
  return (
    <>
      <rect width="64" height="64" fill="url(#bg-hazard)" />
      <ellipse cx="32" cy="46" rx="30" ry="18" fill="url(#glow-ember)" />
      <path d="M2 60 L12 26 L22 60 Z M22 60 L32 18 L42 60 Z M42 60 L52 28 L62 60 Z" fill="url(#bg-spike)" />
      <rect y="56" width="64" height="8" fill="url(#bg-lava)" filter="url(#fx-lava)" />
    </>
  );
}

const TILE_ART: Record<Tile, () => React.JSX.Element> = {
  ".": DirtGround,
  " ": OpenSpace,
  "#": Wall,
  g: Gem,
  p: Miner,
  r: Boulder,
  e: ExitPortal,
  h: Spikes,
  t: Treasurer,
};

export function TileArt({
  tile,
  unstable = false,
  locked = false,
  dormant = false,
}: {
  tile: Tile;
  unstable?: boolean;
  /** Only meaningful for the exit: the quota is still short, so the portal stays sealed. */
  locked?: boolean;
  /** Only meaningful for the Skarbek: no gem has left the cave yet, so he is still sealed in. */
  dormant?: boolean;
}) {
  const Art = tile === "e" && locked ? LockedExit : tile === "t" && dormant ? DormantTreasurer : TILE_ART[tile];

  // The wobble sits on the group rather than the <svg>, so the tile's own box never moves and
  // neighbouring cells cannot be nudged by a shaking boulder.
  return (
    <svg className="block size-full" viewBox="0 0 64 64">
      {unstable ? (
        <g className="boulder-unstable">
          <Art />
        </g>
      ) : (
        <Art />
      )}
    </svg>
  );
}
