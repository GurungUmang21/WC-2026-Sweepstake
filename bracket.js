// ═══════════════════════════════════════════════════════════════
// bracket.js — WC 2026 Circular Knockout Bracket
// Drop into your repo and add <script src="bracket.js"></script>
// after your main script tag. Requires PARTICIPANTS, PROXY_URL
// and FLAGS to be defined in your main script.
// ═══════════════════════════════════════════════════════════════

// ── RING CONFIGURATION ───────────────────────────────────────
// Each ring is one round. Index 0 = outermost (R32), index 4 = Final
const BRACKET_RINGS = [
  { round: 'LAST_32',        size: 32, radius: 46, label: 'R32'  },
  { round: 'LAST_16',        size: 16, radius: 37, label: 'R16'  },
  { round: 'QUARTER_FINALS', size:  8, radius: 28, label: 'QF'   },
  { round: 'SEMI_FINALS',    size:  4, radius: 19, label: 'SF'   },
  { round: 'FINAL',          size:  2, radius: 11, label: 'Final'},
];

// Rotation offset per ring so pairs align with their connectors
const RING_ROTATION_OFFSETS = [
  Math.PI / 32,   // R32
  Math.PI / 16,   // R16
  Math.PI / 8,    // QF
  Math.PI / 4,    // SF
  0,              // Final
];

// Crest sizes per ring — outer is bigger
const CREST_SIZES = [30, 28, 26, 24, 22];

// ── COLOUR PALETTE ───────────────────────────────────────────
const BRACKET_COLORS = {
  connector:   'rgba(255,255,255,0.1)',
  connectorSF: 'rgba(255,255,255,0.15)',
  connectorF:  'rgba(201,168,76,0.35)',
  score:       '#C9A84C',
  scoreTBD:    'rgba(255,255,255,0.2)',
  owner:       '#5B9BD5',
  ownerNone:   'rgba(255,255,255,0.2)',
  winnerBorder:'rgba(93,189,122,0.7)',
  loserOpacity: 0.35,
  dot:         'rgba(255,255,255,0.2)',
  trophy:      'rgba(201,168,76,0.15)',
};

// ── POSITION MATHS ───────────────────────────────────────────
// Returns {x, y} as percentage of container (0–100)
function bracketSlotPos(ringIndex, slotIndex) {
  const ring   = BRACKET_RINGS[ringIndex];
  const offset = RING_ROTATION_OFFSETS[ringIndex];
  const angle  = (2 * Math.PI * slotIndex / ring.size) + offset;
  return {
    x: 50 + ring.radius * Math.sin(angle),
    y: 50 - ring.radius * Math.cos(angle),
  };
}

// Midpoint between two slots on the same ring (for score placement)
function bracketArcMid(ringIndex, slotA, slotB) {
  const pA = bracketSlotPos(ringIndex, slotA);
  const pB = bracketSlotPos(ringIndex, slotB);
  const ring = BRACKET_RINGS[ringIndex];
  // angle of midpoint
  const offset = RING_ROTATION_OFFSETS[ringIndex];
  const midSlot = (slotA + slotB) / 2;
  const angle = (2 * Math.PI * midSlot / ring.size) + offset;
  return {
    x: 50 + ring.radius * Math.sin(angle),
    y: 50 - ring.radius * Math.cos(angle),
  };
}

// SVG arc path between two points
function svgArc(p1, p2, radius, sweep = 1) {
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 ${sweep} ${p2.x} ${p2.y}`;
}

// SVG line between two points
function svgLine(p1, p2) {
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
}

// ── DATA HELPERS ─────────────────────────────────────────────
// Build bracket data structure from API matches
function buildBracketData(matches) {
  const rounds = {};
  BRACKET_RINGS.forEach(r => { rounds[r.round] = []; });

  (matches || []).forEach(m => {
    if (rounds[m.stage] !== undefined) {
      rounds[m.stage].push(m);
    }
  });

  // Sort each round by date so ordering is consistent
  Object.keys(rounds).forEach(stage => {
    rounds[stage].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  });

  return rounds;
}

// Find sweepstake owner for a team name
function bracketFindOwner(teamName) {
  if (!teamName || !window.PARTICIPANTS) return null;
  return window.PARTICIPANTS.find(p =>
    p.c1 === teamName || p.c2 === teamName
  ) || null;
}

// Score display string from a match
function bracketScore(match) {
  if (!match || match.status !== 'FINISHED') return null;
  const h = match.score?.fullTime?.home;
  const a = match.score?.fullTime?.away;
  if (h === null || h === undefined) return null;
  return `${h} – ${a}`;
}

// Winner of a finished match
function bracketWinner(match) {
  if (!match || match.status !== 'FINISHED') return null;
  const h = match.score?.fullTime?.home;
  const a = match.score?.fullTime?.away;
  if (h > a) return match.homeTeam?.name;
  if (a > h) return match.awayTeam?.name;
  // Penalties
  const ph = match.score?.penalties?.home;
  const pa = match.score?.penalties?.away;
  if (ph !== undefined && pa !== undefined) {
    return ph > pa ? match.homeTeam?.name : match.awayTeam?.name;
  }
  return null;
}

// ── SVG CONNECTOR LAYER ──────────────────────────────────────
function buildConnectorSVG(rounds) {
  let paths = '';

  BRACKET_RINGS.forEach((ring, ringIdx) => {
    if (ringIdx >= BRACKET_RINGS.length - 1) return; // no connectors from Final
    const matches = rounds[ring.round] || [];
    const innerRing = BRACKET_RINGS[ringIdx + 1];
    const innerRadius = innerRing.radius;

    // Pair arcs on same ring + radial lines to inner ring
    for (let pairIdx = 0; pairIdx < ring.size / 2; pairIdx++) {
      const slotA = pairIdx * 2;
      const slotB = pairIdx * 2 + 1;
      const pA = bracketSlotPos(ringIdx, slotA);
      const pB = bracketSlotPos(ringIdx, slotB);
      const pInner = bracketSlotPos(ringIdx + 1, pairIdx);

      // Arc connecting the two paired teams
      const color = ringIdx >= 3 ? BRACKET_COLORS.connectorF
                  : ringIdx >= 2 ? BRACKET_COLORS.connectorSF
                  : BRACKET_COLORS.connector;

      paths += `<path d="${svgArc(pA, pB, ring.radius)}"
        stroke="${color}" stroke-width="${ringIdx >= 3 ? 0.4 : 0.2}"
        fill="none"/>`;

      // Radial line from arc midpoint to inner ring slot
      const pMid = bracketArcMid(ringIdx, slotA, slotB);
      paths += `<line x1="${pMid.x}" y1="${pMid.y}"
        x2="${pInner.x}" y2="${pInner.y}"
        stroke="${color}" stroke-width="${ringIdx >= 3 ? 0.4 : 0.2}"/>`;

      // Junction dots
      
    }
  });

  // Trophy glow ring at centre
  paths += `<circle cx="50" cy="50" r="5.5"
    fill="${BRACKET_COLORS.trophy}"
    stroke="rgba(201,168,76,0.25)" stroke-width="0.3"/>`;

  return `<svg class="bracket-svg-connectors"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

// ── SCORE LABELS ─────────────────────────────────────────────
function buildScoreSVG(rounds) {
  let texts = '';

  BRACKET_RINGS.forEach((ring, ringIdx) => {
    if (ringIdx >= BRACKET_RINGS.length - 1) return;
    const matches = rounds[ring.round] || [];

    for (let pairIdx = 0; pairIdx < ring.size / 2; pairIdx++) {
      const match = matches[pairIdx];
      const score = match ? bracketScore(match) : null;
      const label = score;
      const color = BRACKET_COLORS.score;
      const fw = '700';
      const fs = ringIdx === 0 ? 1.8 : ringIdx === 1 ? 2 : 2.4;

      const slotA = pairIdx * 2;
      const slotB = pairIdx * 2 + 1;

      // Place score text along the arc path
      const arcId = `arc-${ringIdx}-${pairIdx}`;
      const pA = bracketSlotPos(ringIdx, slotA);
      const pB = bracketSlotPos(ringIdx, slotB);

      // Determine arc direction (always draw shorter arc)
      const sweep = 1;

      if (label) {
        texts += `<defs>
            <path id="${arcId}"
            d="${svgArc(pA, pB, ring.radius, sweep)}"
            fill="none"/>
        </defs>
        <text font-size="${fs}" font-weight="${fw}"
        fill="${color}" font-family="system-ui,sans-serif">
            <textPath href="#${arcId}" startOffset="50%" text-anchor="middle">
            ${label}
            </textPath>
        </text>`;
        }
    }
  });

  return `<svg class="bracket-svg-scores"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg">${texts}</svg>`;
}

// ── CREST ELEMENTS ───────────────────────────────────────────
function buildCrestElements(rounds) {
  let html = '';

  BRACKET_RINGS.forEach((ring, ringIdx) => {
    const matches = rounds[ring.round] || [];
    const size = CREST_SIZES[ringIdx];

    // Build a flat list of teams in slot order
    const teamSlots = [];
    for (let pairIdx = 0; pairIdx < ring.size / 2; pairIdx++) {
      const match = matches[pairIdx];
      const winner = match ? bracketWinner(match) : null;

      // Home team (even slot)
      teamSlots.push({
        slotIndex: pairIdx * 2,
        team: match?.homeTeam || null,
        match,
        winner,
        isWinner: match && winner === match.homeTeam?.name,
        isLoser:  match && match.status === 'FINISHED' && winner !== match.homeTeam?.name,
      });

      // Away team (odd slot)
      teamSlots.push({
        slotIndex: pairIdx * 2 + 1,
        team: match?.awayTeam || null,
        match,
        winner,
        isWinner: match && winner === match.awayTeam?.name,
        isLoser:  match && match.status === 'FINISHED' && winner !== match.awayTeam?.name,
      });
    }

    teamSlots.forEach(({ slotIndex, team, isWinner, isLoser }) => {
      const pos = bracketSlotPos(ringIdx, slotIndex);
      const owner = team ? bracketFindOwner(team.name) : null;
      const opacity = isLoser ? BRACKET_COLORS.loserOpacity : 1;
      const borderColor = isWinner
        ? BRACKET_COLORS.winnerBorder
        : 'rgba(255,255,255,0.15)';
      const borderStyle = team
        ? `${borderColor}`
        : 'rgba(255,255,255,0.1)';
      const borderDash = !team ? 'dashed' : 'solid';

      // Crest image or placeholder
      const crestImg = team?.crest
        ? `<img src="${team.crest}"
            onerror="this.style.display='none'"
            style="width:${size - 6}px;height:${size - 6}px;object-fit:contain;">`
        : '';

      // Owner label — curved via CSS transform based on position
      // Teams on the top half arc upward, bottom half arc downward
      const angle = Math.atan2(pos.x - 50, 50 - pos.y);
      const ownerColor = owner ? BRACKET_COLORS.owner : BRACKET_COLORS.ownerNone;
      const ownerText = owner ? owner.name : '—';

      // Offset the label away from centre
      const labelDist = size / 2 + 3;
      const labelX = Math.sin(angle) * labelDist;
      const labelY = -Math.cos(angle) * labelDist;
      const labelRotate = (angle * 180 / Math.PI);
      // Flip label if on bottom half so it reads correctly
      const flip = pos.y > 50 ? 180 : 0;

      // if no team yet — show a small dot node instead of empty dark circle
if (!team) {
  html += `
    <div style="
      position: absolute;
      left: ${pos.x}%;
      top: ${pos.y}%;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      z-index: 2;
    "></div>`;
  return; // skip the rest for this slot
}

// team exists — render full crest circle
html += `
  <div class="bracket-slot" style="
    position: absolute;
    left: ${pos.x}%;
    top: ${pos.y}%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  ">
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      overflow: hidden;
      border: 1.5px solid ${borderStyle};
      background: #1a2332;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: ${opacity};
      flex-shrink: 0;
    ">${crestImg}</div>
    <div style="... owner label ..."></div>
  </div>`;
    });
  });

  // Trophy in centre
  html += `
    <div style="
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      z-index: 5;
      pointer-events: none;
      text-align: center;
    ">🏆</div>`;

  return html;
}

// ── MAIN RENDER FUNCTION ─────────────────────────────────────
function renderBracket(footballData) {
    console.log('bracket received:', footballData?.bracket?.length);
  console.log('stages:', [...new Set(footballData?.bracket?.map(m => m.stage))]);
  const container = document.getElementById('bracket');
  if (!container) return;

  const matches = footballData?.bracket || footballData?.upcoming || [];

  // Check if any knockout matches exist yet
  const rounds = buildBracketData(matches);
  const hasKnockout = Object.values(rounds).some(r => r.length > 0);

  if (!hasKnockout) {
    container.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 300px;
        font-size: 13px;
        color: rgba(245,240,232,0.4);
        font-family: system-ui, sans-serif;
      ">
        Bracket available from Round of 32 · approx 1 Jul 2026
      </div>`;
    return;
  }

  // Build all layers
  const connectorSVG = buildConnectorSVG(rounds);
  const scoreSVG     = buildScoreSVG(rounds);
  const crests       = buildCrestElements(rounds);

  container.innerHTML = `
    <div class="bracket-circle" style="
      position: relative;
      width: min(100%, min(90vh, 700px));
      aspect-ratio: 1;
      margin: 0 auto;
    ">
      ${connectorSVG}
      ${scoreSVG}
      ${crests}
    </div>`;
}

// ── CSS ───────────────────────────────────────────────────────
(function injectBracketCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .bracket-svg-connectors,
    .bracket-svg-scores {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }
    .bracket-svg-connectors { z-index: 0; }
    .bracket-svg-scores     { z-index: 1; }
    .bracket-slot           { z-index: 2; }

    #view-bracket {
      padding: 1rem 0;
    }
  `;
  document.head.appendChild(style);
})();

// ── EXPOSE TO MAIN SCRIPT ────────────────────────────────────
// renderBracket() is called from render() in your main script.
// No further setup needed.
