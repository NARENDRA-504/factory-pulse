import React from 'react';

/** Decorative, accessible-by-context production story on the sign-in screen. */
export const LoginProcessAnimation: React.FC = () => (
  <div className="fp-login-process" aria-hidden="true">
    <svg className="fp-login-process__scene" viewBox="0 0 760 220" role="presentation">
      <defs>
        <linearGradient id="fp-machine-shell" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#e4efed"/></linearGradient>
        <linearGradient id="fp-machine-window" x1="0" y1="0" x2="0.9" y2="1"><stop stopColor="#d9f1eb"/><stop offset="1" stopColor="#a9d3c9"/></linearGradient>
        <linearGradient id="fp-belt" x1="0" x2="1"><stop stopColor="#b8cbc7"/><stop offset=".5" stopColor="#edf3f1"/><stop offset="1" stopColor="#baccc8"/></linearGradient>
        <linearGradient id="fp-truck-body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d5eee7"/><stop offset="1" stopColor="#a9d7cb"/></linearGradient>
        <radialGradient id="fp-scene-glow"><stop stopColor="#a7e0d3" stopOpacity=".4"/><stop offset="1" stopColor="#a7e0d3" stopOpacity="0"/></radialGradient>
        <filter id="fp-soft-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#254e48" floodOpacity=".13"/></filter>
        <filter id="fp-part-shadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#6b4c17" floodOpacity=".2"/></filter>
      </defs>

      <ellipse cx="380" cy="183" rx="354" ry="19" fill="url(#fp-scene-glow)"/>
      <path d="M24 181h711" stroke="#d7e4e1" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 190h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30m14 0h30" stroke="#e2ece9" strokeWidth="2" strokeLinecap="round"/>

      {/* Machining station */}
      <g filter="url(#fp-soft-shadow)">
        <rect x="23" y="30" width="166" height="131" rx="15" fill="url(#fp-machine-shell)" stroke="#c8dad6" strokeWidth="1.5"/>
        <path d="M23 57h166" stroke="#dce8e5" strokeWidth="1.5"/>
        <circle cx="39" cy="44" r="3" fill="#8dcab9"/><circle cx="50" cy="44" r="3" fill="#f1c56f"/>
        <text x="66" y="47" className="fp-process-label">CNC CELL 01</text>
        <rect x="34" y="69" width="98" height="75" rx="9" fill="url(#fp-machine-window)" stroke="#aac9c2"/>
        <path d="M41 132h83M50 76v60" stroke="#c4e2db" strokeWidth="2" opacity=".8"/>
        <rect x="139" y="69" width="38" height="75" rx="7" fill="#f5f9f8" stroke="#d3e1de"/>
        <circle cx="151" cy="83" r="3.5" fill="#2da487"/><circle cx="163" cy="83" r="3.5" fill="#b8d4ce"/>
        <rect x="148" y="96" width="20" height="5" rx="2.5" fill="#d7e5e1"/><rect x="148" y="106" width="14" height="5" rx="2.5" fill="#d7e5e1"/>
        <path d="M76 122v-23h12l5 7h13v16z" fill="#e8b955" stroke="#c99537" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M92 99v7h14" fill="none" stroke="#fff4d7" strokeWidth="2"/>
        <path d="M85 92h27" stroke="#7d9992" strokeWidth="4" strokeLinecap="round"/>
        <g transform="translate(99 91)">
          <g className="fp-process-gear">
            <path d="M-4-18h8l1.5 5.2 4 1.7 4.7-2.8 5.6 5.6-2.8 4.7 1.7 4L24 2v8l-5.3 1.5-1.7 4 2.8 4.7-5.6 5.6-4.7-2.8-4 1.7L4 30h-8l-1.5-5.3-4-1.7-4.7 2.8-5.6-5.6 2.8-4.7-1.7-4L-24 10V2l5.3-1.5 1.7-4-2.8-4.7 5.6-5.6 4.7 2.8 4-1.7z" transform="scale(.68)" fill="#fff" stroke="#398f81" strokeWidth="2.4" strokeLinejoin="round"/>
            <circle r="6" fill="#d9f0ea" stroke="#398f81" strokeWidth="2"/><circle r="2" fill="#398f81"/>
          </g>
        </g>
        <path d="M49 161v8m114-8v8" stroke="#8ca9a2" strokeWidth="5" strokeLinecap="round"/>
      </g>

      {/* Worker in simple safety gear carrying a finished piece */}
      <g className="fp-process-worker">
        <circle cx="221" cy="77" r="14" fill="#eebf9c"/>
        <path d="M207 76q1-17 15-17 12 0 14 13l-4 2q-5-6-12-6-6 0-13 8z" fill="#36505b"/>
        <path d="M205 73q16-11 34 0l-2-7q-5-9-15-9-12 0-17 10z" fill="#f0bd59"/>
        <path d="M198 99q23-14 45 0l8 48h-61z" fill="#398f81"/>
        <path className="fp-process-arm" d="M206 105l-18 15-8 5M237 105l16 14" fill="none" stroke="#eebf9c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M207 147l-3 19m28-19 5 19" stroke="#405761" strokeWidth="8" strokeLinecap="round"/>
        <path d="M197 166h13m24 0h13" stroke="#293f49" strokeWidth="5" strokeLinecap="round"/>
        <path d="M212 102l6 17h13l6-17" fill="#d9f0e9" stroke="#2c786d" strokeWidth="1.5"/>
        <circle cx="178" cy="125" r="4" fill="#eebf9c"/>
      </g>

      {/* Inspection gate */}
      <text x="306" y="44" className="fp-process-label">QUALITY CHECK</text>
      <g>
        <path d="M298 136V79q0-13 13-13h79q13 0 13 13v57" fill="none" stroke="#72b7a7" strokeWidth="7" strokeLinecap="round"/>
        <path d="M305 82v48m89-48v48" stroke="#d1e8e2" strokeWidth="2"/>
        <circle className="fp-process-check" cx="350" cy="78" r="13" fill="#f3fbf8" stroke="#45a48f" strokeWidth="2"/>
        <path d="m344 78 4 4 8-9" fill="none" stroke="#27806f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M310 96v31m80-31v31" stroke="#8dd0be" strokeWidth="2" strokeDasharray="3 5"/>
      </g>

      {/* Roller conveyor */}
      <g>
        <rect x="278" y="145" width="331" height="16" rx="8" fill="url(#fp-belt)" stroke="#bacdc8"/>
        <path d="M291 162l-6 15m292-15 6 15" stroke="#9eb7b0" strokeWidth="5" strokeLinecap="round"/>
        <g className="fp-process-rollers" fill="#90aaa3">
          <circle cx="296" cy="153" r="4"/><circle cx="324" cy="153" r="4"/><circle cx="352" cy="153" r="4"/><circle cx="380" cy="153" r="4"/><circle cx="408" cy="153" r="4"/><circle cx="436" cy="153" r="4"/><circle cx="464" cy="153" r="4"/><circle cx="492" cy="153" r="4"/><circle cx="520" cy="153" r="4"/><circle cx="548" cy="153" r="4"/><circle cx="576" cy="153" r="4"/>
        </g>
      </g>

      {/* PDA scan point */}
      <text x="466" y="44" className="fp-process-label">SCAN &amp; LOG</text>
      <g className="fp-process-scanner">
        <path d="M480 74q0-5 5-5h28q5 0 5 5v37q0 5-5 5h-28q-5 0-5-5z" fill="#fff" stroke="#789b93" strokeWidth="2"/>
        <rect x="485" y="75" width="18" height="22" rx="3" fill="#e1f4ed"/>
        <path d="M489 81h10m-10 4h10m-10 4h7" stroke="#398f81" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M501 100l6 17q1 4-3 5l-5 2q-4 1-5-3l-5-15" fill="#d4e6e1" stroke="#789b93" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="499" cy="106" r="2" fill="#39ac92"/>
        <path className="fp-process-scanline" d="M468 130h65" stroke="#35b596" strokeWidth="2.5" strokeDasharray="5 4"/>
      </g>

      {/* Dispatch truck */}
      <text x="630" y="44" className="fp-process-label">DISPATCH</text>
      <g className="fp-process-truck" filter="url(#fp-soft-shadow)">
        <path d="M613 94q0-5 5-5h67q5 0 8 4l15 20v28h-95z" fill="url(#fp-truck-body)" stroke="#729c91" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M682 96h4l12 16h-16z" fill="#f6fbfa" stroke="#8eaaa3" strokeWidth="1.5"/>
        <rect x="622" y="99" width="48" height="33" rx="3" fill="#f7fbfa" stroke="#b5cdc6"/>
        <path d="M628 106h36m-36 7h36m-36 7h24" stroke="#c8ded8" strokeWidth="2" strokeLinecap="round"/>
        <path d="M700 121h8" stroke="#eab958" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="635" cy="143" r="10" fill="#344e58"/><circle cx="635" cy="143" r="4" fill="#edf5f2"/>
        <circle cx="690" cy="143" r="10" fill="#344e58"/><circle cx="690" cy="143" r="4" fill="#edf5f2"/>
      </g>

      {/* The same finished part travels through each stage. */}
      <g className="fp-process-part" filter="url(#fp-part-shadow)">
        <path d="M0 0h22l8 8v16H0z" fill="#f2c15e" stroke="#bd8c31" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M22 0v8h8M6 8h10M6 14h16" fill="none" stroke="#fff8e6" strokeWidth="2"/>
      </g>
      <text x="27" y="202" className="fp-process-caption">ONE PART · CHECKED · TRACEABLE · READY TO SHIP</text>
    </svg>
    <div className="fp-login-process__foot"><span>Machine</span><i/><span>Quality</span><i/><span>Scan</span><i/><span>Dispatch</span></div>
  </div>
);

