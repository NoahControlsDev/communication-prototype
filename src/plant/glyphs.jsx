// The glyph library: the only per-shape code. Each draws into a 108 x 96 cell.
// Parts carry classes the stylesheet animates from the device's state:
//   .eq-live → fills darker when running · .spin → rotates when running · .alm → alarm dot

const Pump = () => (
  <>
    <path className="pl-pipe" d="M0 44h14M44 14V0" />
    <circle className="pl-eq pl-live" cx="44" cy="44" r="25" />
    <g transform="translate(44,44)"><g className="pl-spin">
      <circle className="pl-anchor" cx="0" cy="0" r="17" />
      <path className="pl-d" d="M0-17c8 3 12 9 11 17M0 17c-8-3-12-9-11-17M15 8c-5 7-12 9-19 6" />
      <circle className="pl-solid" cx="0" cy="0" r="3.2" />
    </g></g>
    <rect className="pl-eq" x="40" y="8" width="8" height="10" />
    <rect className="pl-eq pl-live" x="74" y="32" width="28" height="24" rx="2" />
    <path className="pl-d" d="M69 44h5M80 38v12M87 38v12M94 38v12" />
    <rect className="pl-eq" x="26" y="76" width="56" height="17" rx="2" />
  </>
)

const Vessel = () => (
  <>
    <rect className="pl-eq" x="54" y="2" width="10" height="13" />
    <rect className="pl-eq pl-live" x="10" y="14" width="66" height="56" rx="3" />
    <path className="pl-d" d="M18 26h20M18 33h20" />
    <path className="pl-flame" d="M43 62c-7-4-8-11-4-16 1 4 3 5 4 4-1-6 2-10 6-13-1 6 2 8 4 12 2 4 1 11-4 13z" />
    <rect className="pl-eq" x="20" y="63" width="46" height="5" rx="1.5" />
    <path className="pl-pipe" d="M0 58h10M76 24h32" />
    <g transform="translate(88,58)">
      <circle className="pl-eq pl-live" cx="0" cy="0" r="10" />
      <g className="pl-spin"><circle className="pl-anchor" cx="0" cy="0" r="6" /><path className="pl-d" d="M-6 0h12M-3-5l6 10M3-5l-6 10" /></g>
    </g>
  </>
)

const FanBox = () => (
  <>
    <rect className="pl-eq pl-live" x="6" y="12" width="96" height="58" rx="3" />
    <circle className="pl-eq" cx="35" cy="41" r="19" style={{ fill: 'none' }} />
    <g transform="translate(35,41)"><g className="pl-spin">
      <circle className="pl-anchor" cx="0" cy="0" r="15" />
      <path className="pl-d" d="M0-15c6 4 6 10 0 14M13 7c-7 1-11-3-12-9M-13 7c1-7 6-9 12-5" />
      <circle className="pl-solid" cx="0" cy="0" r="3" />
    </g></g>
    <path className="pl-d" d="M64 20v42M71 20v42M78 20v42M85 20v42" />
    <rect className="pl-eq" x="58" y="16" width="36" height="50" rx="2" style={{ fill: 'none' }} />
  </>
)

// Fallback for a type with no drawing yet: a box with an activity indicator.
const Generic = () => (
  <>
    <rect className="pl-eq pl-live" x="14" y="12" width="80" height="62" rx="5" />
    <path className="pl-d" d="M26 28h56M26 36h40" />
    <g transform="translate(54,56)"><g className="pl-spin">
      <circle className="pl-anchor" cx="0" cy="0" r="9" />
      <path className="pl-d" d="M-9 0h18M0-9v18" />
    </g></g>
  </>
)

// Keys must match GLYPH_NAMES in model.js.
const GLYPHS = { pump: Pump, vessel: Vessel, fanbox: FanBox, generic: Generic }

export function Glyph({ name }) {
  const G = GLYPHS[name] ?? Generic
  return (
    <svg className="pl-glyph" viewBox="0 0 108 96" aria-hidden="true">
      <G />
      <circle className="pl-alm" cx="98" cy="10" r="6" />
    </svg>
  )
}
