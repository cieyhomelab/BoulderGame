export type Tile = "." | "#" | "g" | "p" | "r" | "e" | "h";

const DIRT_SPECKS = [
  { cx: 13.5, cy: 16.5, rx: 3.5, ry: 2.5, fill: "#1f2a19" },
  { cx: 40.5, cy: 12, rx: 2.5, ry: 2, fill: "#46583c" },
  { cx: 26.5, cy: 43, rx: 4.5, ry: 3, fill: "#1f2a19" },
  { cx: 51, cy: 46, rx: 3, ry: 2, fill: "#46583c" },
  { cx: 32, cy: 27.5, rx: 2, ry: 1.5, fill: "#46583c" },
] as const;

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
      <DirtGround />
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
      <DirtGround />
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
  "#": Wall,
  g: Gem,
  p: Miner,
  r: Boulder,
  e: ExitPortal,
  h: Spikes,
};

export function TileArt({ tile }: { tile: Tile }) {
  const Art = TILE_ART[tile];

  return (
    <svg className="block size-full" viewBox="0 0 64 64">
      <Art />
    </svg>
  );
}
