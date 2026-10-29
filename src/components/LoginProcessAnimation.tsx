import React from 'react';

/**
 * Animated CNC Machining Center illustration for the sign-in screen.
 * Displays only the active CNC machine operating at high precision with running spindle,
 * tool cutter motion, coolant spray, live HMI telemetry readouts, and status beacon.
 */
export const LoginProcessAnimation: React.FC = () => (
  <div className="fp-login-process" aria-hidden="true">
    <svg className="fp-login-process__scene" viewBox="0 0 760 220" role="presentation">
      <defs>
        {/* Machine body & enclosure gradients */}
        <linearGradient id="fp-mach-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f4f8f7" />
          <stop offset="100%" stopColor="#e2eeea" />
        </linearGradient>

        <linearGradient id="fp-mach-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e584f" />
          <stop offset="100%" stopColor="#2c7a6e" />
        </linearGradient>

        <linearGradient id="fp-mach-window" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#e1f5ef" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#c5e7de" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#a3d5c9" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="fp-spindle-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8ba59f" />
          <stop offset="50%" stopColor="#e9f3f0" />
          <stop offset="100%" stopColor="#69857f" />
        </linearGradient>

        <linearGradient id="fp-cutter-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd875" />
          <stop offset="100%" stopColor="#d89620" />
        </linearGradient>

        <linearGradient id="fp-hmi-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#142e2a" />
          <stop offset="100%" stopColor="#0b1e1b" />
        </linearGradient>

        <radialGradient id="fp-floor-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#14b8a6" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="fp-chamber-light" cx="45%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#d5eee7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#a7d6cb" stopOpacity="0.05" />
        </radialGradient>

        <filter id="fp-mach-shadow" x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#1a423b" floodOpacity="0.14" />
        </filter>

        <filter id="fp-beacon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Ground plane & subtle floor glow */}
      <ellipse cx="380" cy="192" rx="280" ry="16" fill="url(#fp-floor-glow)" />
      <path d="M120 191h520" stroke="#d5e4e0" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M140 198h36m16 0h36m16 0h36m16 0h36m16 0h36m16 0h36m16 0h36m16 0h36m16 0h36m16 0h36"
        stroke="#e4eeec"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Heavy Machine Leveling Feet (Anchored into floor) */}
      <g stroke="#7b9992" strokeWidth="6" strokeLinecap="round">
        <path d="M195 183v9" />
        <path d="M295 183v9" />
        <path d="M465 183v9" />
        <path d="M565 183v9" />
      </g>
      {/* Vibration damping footpads */}
      <rect x="183" y="190" width="24" height="4" rx="2" fill="#4d6963" />
      <rect x="283" y="190" width="24" height="4" rx="2" fill="#4d6963" />
      <rect x="453" y="190" width="24" height="4" rx="2" fill="#4d6963" />
      <rect x="553" y="190" width="24" height="4" rx="2" fill="#4d6963" />

      {/* Main CNC Machining Center Structure */}
      <g filter="url(#fp-mach-shadow)">
        {/* Machine Outer Enclosure */}
        <rect
          x="152"
          y="28"
          width="456"
          height="156"
          rx="18"
          fill="url(#fp-mach-shell)"
          stroke="#bcd3cd"
          strokeWidth="1.8"
        />

        {/* Top Accent Stripe / Brand Band */}
        <path
          d="M153 28h454c9.94 0 18 8.06 18 18v12H135V46c0-9.94 8.06-18 18-18z"
          fill="url(#fp-mach-accent)"
        />

        {/* Stack Light Beacon (Signal Tower) */}
        <g transform="translate(178, 11)">
          <rect x="-2" y="10" width="16" height="8" rx="2" fill="#2d524b" />
          <rect x="4" y="2" width="4" height="8" fill="#587972" />
          {/* Signal tiers: Red off, Amber off, Green ACTIVE RUNNING */}
          <circle cx="6" cy="-2" r="3" fill="#697f7a" />
          <circle cx="6" cy="-10" r="3" fill="#697f7a" />
          <circle
            className="fp-process-beacon"
            cx="6"
            cy="-18"
            r="4.5"
            fill="#10b981"
            filter="url(#fp-beacon-glow)"
          />
        </g>

        {/* Machine Header & Identification */}
        <circle cx="218" cy="45" r="3.5" fill="#34d399" className="fp-process-beacon" />
        <circle cx="230" cy="45" r="3" fill="#fbbf24" />
        <circle cx="241" cy="45" r="3" fill="#93c5fd" />

        <text x="256" y="49" fill="#ffffff" font-size="11" font-weight="800" letter-spacing="1.5" fontFamily="'Public Sans', system-ui, sans-serif">
          CNC CELL 01
        </text>

        <text x="360" y="49" fill="#a4d7cb" font-size="8.5" font-weight="600" letter-spacing="1.2" fontFamily="'Public Sans', system-ui, sans-serif">
          5-AXIS PRECISION MACHINING CENTER
        </text>

        {/* Cycle Active Badge */}
        <g transform="translate(528, 38)">
          <rect x="0" y="0" width="66" height="15" rx="7.5" fill="#0d3b33" stroke="#22c55e" strokeWidth="1" />
          <circle cx="9" cy="7.5" r="3" fill="#22c55e" className="fp-process-beacon" />
          <text x="17" y="10.5" fill="#86efac" font-size="7.5" font-weight="700" letter-spacing="0.8" fontFamily="'Public Sans', system-ui, sans-serif">
            RUNNING
          </text>
        </g>

        {/* ======================================================== */}
        {/* MACHINING CHAMBER (Left / Center Enclosure)              */}
        {/* ======================================================== */}
        {/* Chamber Outer Cutout Frame */}
        <rect
          x="168"
          y="62"
          width="322"
          height="112"
          rx="12"
          fill="#17312d"
          stroke="#254d46"
          strokeWidth="1.5"
        />

        {/* Interior Chamber Backdrop & Lighting */}
        <rect x="172" y="66" width="314" height="104" rx="8" fill="url(#fp-chamber-light)" />

        {/* X-Axis Linear Guideway Rails */}
        <path d="M180 94h298" stroke="#375d56" strokeWidth="3" />
        <path d="M180 102h298" stroke="#284842" strokeWidth="2" />
        <path d="M180 94h298" stroke="#52837a" strokeWidth="1" strokeDasharray="6 8" />

        {/* T-Slot Heavy Milling Worktable */}
        <rect x="210" y="148" width="238" height="18" rx="4" fill="#32544e" stroke="#48756d" strokeWidth="1.5" />
        <path d="M220 154h218M220 159h218" stroke="#213d38" strokeWidth="1.5" />

        {/* Precision Hydraulic Clamping Vise */}
        <rect x="270" y="137" width="118" height="14" rx="3" fill="#50706a" stroke="#719890" strokeWidth="1.2" />
        <rect x="264" y="134" width="10" height="18" rx="2" fill="#86a8a1" />
        <rect x="384" y="134" width="10" height="18" rx="2" fill="#86a8a1" />
        <circle cx="269" cy="143" r="2.5" fill="#364e49" />
        <circle cx="389" cy="143" r="2.5" fill="#364e49" />

        {/* Workpiece Billet (Machined Alloy Component) */}
        <g transform="translate(290, 116)">
          <path
            d="M0 8h18l10-10h34l12 12v14H0z"
            fill="url(#fp-cutter-gold)"
            stroke="#a97618"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Internal machined grooves & finish highlights */}
          <path d="M18 8v16M28 -2v26M62 10v14" stroke="#fff8dd" strokeWidth="1.5" opacity="0.9" />
          <path d="M6 14h62" stroke="#b67f1a" strokeWidth="1.2" />
        </g>

        {/* Dual Flexible Coolant Nozzles */}
        <path
          d="M260 88q25 8 36 24"
          fill="none"
          stroke="#41736b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="297" cy="113" r="3" fill="#71b5a8" />
        <path
          d="M396 88q-25 8 -36 24"
          fill="none"
          stroke="#41736b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="359" cy="113" r="3" fill="#71b5a8" />

        {/* Coolant fluid micro-jet streaming toward cutter contact zone */}
        <path
          className="fp-process-coolant"
          d="M298 114l22 10M358 114l-22 10"
          stroke="#5eead4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />

        {/* Vertical Spindle Head & Z-Axis Column */}
        <g className="fp-process-spindle" transform="translate(328, 62)">
          {/* Spindle Quill Housing */}
          <rect x="-18" y="0" width="36" height="34" rx="4" fill="url(#fp-spindle-metal)" stroke="#55756e" strokeWidth="1.5" />
          <rect x="-14" y="6" width="28" height="4" rx="1.5" fill="#32524b" />
          <rect x="-14" y="14" width="28" height="4" rx="1.5" fill="#32524b" />
          <circle cx="0" cy="25" r="3" fill="#10b981" className="fp-process-beacon" />

          {/* High-Precision Toolholder & Collet Chuck */}
          <path d="M-10 34h20l-4 12h-12z" fill="#3a5852" stroke="#5a7e77" strokeWidth="1.2" />
          <rect x="-6" y="46" width="12" height="7" rx="1" fill="#789c94" stroke="#4a6d65" strokeWidth="1" />

          {/* Rotating Cutter Tool / Endmill with active rotation */}
          <g transform="translate(0, 56)">
            <g className="fp-process-gear">
              {/* Spinning tool profile with cutting flutes */}
              <path
                d="M-5-7h10l2 4 3-1 2 4-2 3 3 2-1 4-4 1-1 4h-4l-1-4-4-1-1-4 3-2-2-3 2-4 3 1z"
                fill="#ffffff"
                stroke="#1b5a50"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle r="4" fill="#a7f3d0" stroke="#047857" strokeWidth="1.5" />
              <circle r="1.5" fill="#047857" />
            </g>
          </g>

          {/* Chip ejection / sparks fluttering away from cutting zone */}
          <g className="fp-process-chips" transform="translate(0, 62)">
            <circle cx="-14" cy="2" r="1.5" fill="#fde047" />
            <circle cx="-18" cy="-5" r="1.2" fill="#fbbf24" />
            <circle cx="15" cy="1" r="1.5" fill="#fde047" />
            <circle cx="19" cy="-4" r="1.2" fill="#fbbf24" />
          </g>
        </g>

        {/* Safety Glass Glare / Chamber Reflection Highlight */}
        <path
          d="M172 66l60 104h28l-60-104z"
          fill="#ffffff"
          opacity="0.12"
        />
        <path
          d="M268 66l60 104h16l-60-104z"
          fill="#ffffff"
          opacity="0.08"
        />

        {/* Chamber Glass Safety Border Frame */}
        <rect
          x="168"
          y="62"
          width="322"
          height="112"
          rx="12"
          fill="none"
          stroke="#6ea79b"
          strokeWidth="2.5"
          opacity="0.6"
        />

        {/* ======================================================== */}
        {/* CNC HMI OPERATOR CONTROL STATION (Right side)           */}
        {/* ======================================================== */}
        {/* Control Enclosure Bay */}
        <rect
          x="498"
          y="62"
          width="98"
          height="112"
          rx="10"
          fill="#edf5f3"
          stroke="#c2d8d2"
          strokeWidth="1.5"
        />

        {/* Digital Touchscreen Display */}
        <rect
          x="506"
          y="70"
          width="82"
          height="50"
          rx="6"
          fill="url(#fp-hmi-screen)"
          stroke="#204c44"
          strokeWidth="1.5"
        />

        {/* Screen Header & Live Readings */}
        <text x="512" y="80" fill="#34d399" font-size="7" font-weight="700" fontFamily="monospace">
          12,000 RPM
        </text>
        <text x="556" y="80" fill="#93c5fd" font-size="6.5" font-weight="600" fontFamily="monospace">
          LOAD 68%
        </text>

        {/* Animated Oscilloscope / Tool Vibration Waveform */}
        <g className="fp-process-wave">
          <path
            d="M512 94q6 -8 12 0t12 0t12 -6t12 6t12 -3t10 3"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {/* Feed rate & Vibration metrics */}
        <text x="512" y="106" fill="#a7f3d0" font-size="6" font-weight="600" fontFamily="monospace">
          F: 450 mm/m
        </text>
        <text x="554" y="106" fill="#fde047" font-size="6" font-weight="600" fontFamily="monospace">
          1.24 mm/s
        </text>

        <path d="M512 112h70" stroke="#1c473f" strokeWidth="1" />

        {/* Operator Controls & Buttons */}
        <g transform="translate(508, 126)">
          {/* Cycle Start (Green Button) */}
          <circle cx="9" cy="8" r="6" fill="#059669" stroke="#34d399" strokeWidth="1.2" />
          <polygon points="7,5 12,8 7,11" fill="#ffffff" />

          {/* Feed Hold (Amber Button) */}
          <circle cx="27" cy="8" r="5" fill="#d97706" stroke="#fbbf24" strokeWidth="1" />
          <rect x="25" y="6" width="4" height="4" fill="#ffffff" />

          {/* Emergency Stop (Safety Red Mushroom Button) */}
          <circle cx="49" cy="8" r="7.5" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.5" />
          <circle cx="49" cy="8" r="4.5" fill="#b91c1c" />
          <circle cx="49" cy="8" r="2" fill="#ef4444" />
        </g>

        {/* Ventilation Louvers (Lower Right) */}
        <g stroke="#9bbbb4" strokeWidth="1.5" strokeLinecap="round">
          <path d="M514 148h66" />
          <path d="M514 154h66" />
          <path d="M514 160h66" />
          <path d="M514 166h66" />
        </g>
      </g>
    </svg>

    {/* Live CNC Machine Running Status Strip */}
    <div className="fp-login-process__foot">
      <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        CNC CELL 01 · SPINDLE RUNNING
      </span>
      <i />
      <span>12,000 RPM</span>
      <i />
      <span>FEED: 450 mm/min</span>
      <i />
      <span>VIBRATION: 1.24 mm/s NOMINAL</span>
    </div>
  </div>
);
