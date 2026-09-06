import React from 'react';

/**
 * Editorial EdTech Hero Illustration for Authentication and Brand Screens
 * Motifs: Student study workspace, open books, modern laptop with assessment,
 * checklist scorecard, graduation cap, potted plant, paper airplane, soft pastel clouds.
 */
export const AuthHeroIllustration = ({ className = 'w-full max-w-md mx-auto' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg
      viewBox="0 0 540 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto drop-shadow-sm"
      aria-label="Student engaging with online assessment on laptop"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="warmBlobGrad" x1="60" y1="40" x2="480" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDEFE2" />
          <stop offset="50%" stopColor="#FFF9F2" />
          <stop offset="100%" stopColor="#EEF6F4" />
        </linearGradient>
        <linearGradient id="terracottaGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E05D38" />
          <stop offset="100%" stopColor="#C94A26" />
        </linearGradient>
        <linearGradient id="peachGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4A261" />
          <stop offset="100%" stopColor="#E7924F" />
        </linearGradient>
        <linearGradient id="sageGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3D8A78" />
          <stop offset="100%" stopColor="#2E6C5E" />
        </linearGradient>
        <linearGradient id="softBlueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3F7FB" />
          <stop offset="100%" stopColor="#E1ECF7" />
        </linearGradient>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#E05D38" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Background Organic Shapes */}
      <path
        d="M80,160 C50,260 110,380 230,390 C360,400 460,340 480,220 C500,100 390,50 270,60 C150,70 100,80 80,160 Z"
        fill="url(#warmBlobGrad)"
        className="opacity-90 dark:opacity-20"
      />

      {/* Floating Gentle Clouds */}
      <g opacity="0.8">
        <path
          d="M70 110 C70 98 80 88 92 88 C97 88 102 90 106 93 C111 83 122 76 134 76 C151 76 164 89 164 105 C164 107 164 108 163 110 L70 110 Z"
          fill="#FFFFFF"
          className="dark:fill-slate-700/60"
        />
        <path
          d="M400 90 C400 80 408 72 418 72 C422 72 426 74 429 76 C433 68 442 62 452 62 C466 62 477 73 477 86 C477 88 477 89 476 90 L400 90 Z"
          fill="#FFFFFF"
          className="dark:fill-slate-700/60"
        />
      </g>

      {/* Trajectory dotted curve */}
      <path
        d="M120 320 C180 280 200 180 320 160 C400 145 440 180 480 130"
        stroke="#F4A261"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.4"
      />

      {/* Desk Base */}
      <rect x="60" y="340" width="420" height="14" rx="7" fill="#EBE3D8" className="dark:fill-slate-700" />
      <rect x="90" y="354" width="14" height="60" rx="4" fill="#DDD4C7" className="dark:fill-slate-800" />
      <rect x="436" y="354" width="14" height="60" rx="4" fill="#DDD4C7" className="dark:fill-slate-800" />

      {/* Potted Plant on Desk */}
      <g transform="translate(85, 260)">
        {/* Pot */}
        <path d="M12 55 L38 55 L44 80 L6 80 Z" fill="#E05D38" opacity="0.85" />
        <rect x="4" y="51" width="42" height="6" rx="3" fill="#C94A26" />
        {/* Foliage leaves */}
        <path d="M25 50 C15 35 5 40 10 25 C18 20 28 35 25 50 Z" fill="#3D8A78" />
        <path d="M25 50 C35 30 48 32 42 18 C30 18 22 35 25 50 Z" fill="#4AA590" />
        <path d="M25 50 C22 25 28 10 32 5 C36 15 32 35 25 50 Z" fill="#2E6C5E" />
      </g>

      {/* Student Character Seated */}
      <g transform="translate(170, 160)">
        {/* Body & Sweater (Terracotta) */}
        <path
          d="M50 140 C50 110 70 95 100 95 C130 95 150 110 150 140 L150 180 L50 180 Z"
          fill="url(#terracottaGrad)"
        />
        {/* White Collar Shirt under sweater */}
        <path d="M90 95 L100 112 L110 95 Z" fill="#FFFFFF" />

        {/* Head & Hair */}
        <circle cx="100" cy="62" r="24" fill="#FBD6B8" />
        {/* Modern Hair */}
        <path
          d="M76 60 C76 42 88 36 102 36 C118 36 126 44 126 56 C126 62 120 64 120 64 C116 52 110 48 98 48 C88 48 80 54 76 60 Z"
          fill="#374151"
        />
        {/* Glasses */}
        <circle cx="93" cy="62" r="6" stroke="#374151" strokeWidth="2" fill="none" />
        <circle cx="107" cy="62" r="6" stroke="#374151" strokeWidth="2" fill="none" />
        <line x1="99" y1="62" x2="101" y2="62" stroke="#374151" strokeWidth="2" />
        {/* Cheerful expression */}
        <path d="M96 72 Q100 76 104 72" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" />

        {/* Arms resting toward laptop */}
        <path
          d="M60 140 C60 155 80 170 110 170"
          stroke="#FBD6B8"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>

      {/* Modern Laptop on Desk */}
      <g transform="translate(240, 240)">
        {/* Screen Bezel */}
        <rect x="20" y="20" width="130" height="85" rx="8" fill="#1F2937" />
        {/* Glowing Display */}
        <rect x="25" y="25" width="120" height="75" rx="5" fill="#F3F7FB" className="dark:fill-slate-800" />
        {/* Screen Content: Quiz code / question UI */}
        <rect x="35" y="35" width="60" height="8" rx="4" fill="#E05D38" />
        <rect x="35" y="50" width="100" height="5" rx="2.5" fill="#CBD5E1" className="dark:fill-slate-600" />
        <rect x="35" y="60" width="85" height="5" rx="2.5" fill="#CBD5E1" className="dark:fill-slate-600" />
        {/* Choice buttons on screen */}
        <rect x="35" y="74" width="45" height="14" rx="4" fill="#3D8A78" />
        <rect x="85" y="74" width="45" height="14" rx="4" fill="#E2E8F0" className="dark:fill-slate-700" />

        {/* Laptop Base */}
        <path d="M5 104 L165 104 L155 112 L15 112 Z" fill="#94A3B8" />
        <rect x="70" y="104" width="30" height="3" rx="1.5" fill="#64748B" />
      </g>

      {/* Floating Assessment Checklist Card */}
      <g transform="translate(340, 95)" filter="url(#softShadow)">
        <rect
          width="155"
          height="190"
          rx="18"
          fill="#FFFFFF"
          className="dark:fill-slate-850 stroke-surface-light-border dark:stroke-surface-dark-border"
          stroke="#EBE3D8"
          strokeWidth="1.5"
        />
        {/* Header Ribbon */}
        <rect x="18" y="22" width="70" height="10" rx="5" fill="#E05D38" />
        <circle cx="128" cy="27" r="4" fill="#3D8A78" />

        {/* Question 1 Item (Correct) */}
        <circle cx="28" cy="58" r="9" fill="#EEF6F4" />
        <path d="M25 58 L27 60 L32 55" stroke="#3D8A78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="44" y="54" width="85" height="7" rx="3.5" fill="#E2E8F0" className="dark:fill-slate-700" />

        {/* Question 2 Item (Correct) */}
        <circle cx="28" cy="88" r="9" fill="#EEF6F4" />
        <path d="M25 88 L27 90 L32 85" stroke="#3D8A78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="44" y="84" width="75" height="7" rx="3.5" fill="#E2E8F0" className="dark:fill-slate-700" />

        {/* Question 3 Item (In Review / Active) */}
        <circle cx="28" cy="118" r="9" fill="#FEF5ED" />
        <circle cx="28" cy="118" r="3.5" fill="#F4A261" />
        <rect x="44" y="114" width="90" height="7" rx="3.5" fill="#E2E8F0" className="dark:fill-slate-700" />

        {/* Evaluation Metric Pill */}
        <rect x="16" y="145" width="123" height="32" rx="10" fill="#F3F7FB" className="dark:fill-slate-800" />
        <text x="26" y="160" fontSize="8" fontWeight="700" fill="#64748B" letterSpacing="0.5">GRADE OUTCOME</text>
        <text x="26" y="172" fontSize="11" fontWeight="800" fill="#3D8A78">96% · High Distinction</text>
      </g>

      {/* Floating Academic Cap Badge */}
      <g transform="translate(135, 60)" filter="url(#softShadow)">
        <circle cx="26" cy="26" r="24" fill="url(#peachGrad)" />
        {/* Mortarboard */}
        <path d="M14 24 L26 18 L38 24 L26 30 Z" fill="#FFFFFF" />
        <path d="M18 26 V32 C18 35 34 35 34 32 V26" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M38 24 V34" stroke="#FFF9F2" strokeWidth="2" strokeLinecap="round" />
        <circle cx="38" cy="34" r="1.5" fill="#FFFFFF" />
      </g>

      {/* Floating Paper Airplane */}
      <g transform="translate(430, 40) rotate(15)">
        <path
          d="M0 15 L28 0 L18 24 L10 16 Z"
          fill="#3D8A78"
          opacity="0.9"
        />
        <path d="M10 16 L28 0 L18 16 Z" fill="#2E6C5E" />
      </g>

      {/* Stack of books on desk */}
      <g transform="translate(390, 310)">
        {/* Book 1 (Sage) */}
        <rect x="0" y="20" width="55" height="10" rx="3" fill="#3D8A78" />
        {/* Book 2 (Peach) */}
        <rect x="5" y="10" width="48" height="10" rx="3" fill="#F4A261" />
        {/* Book 3 (Terracotta) */}
        <rect x="8" y="0" width="44" height="10" rx="3" fill="#E05D38" />
      </g>
    </svg>
  </div>
);

/**
 * Student Dashboard Hero Motif
 */
export const StudentHeroIllustration = ({ className = 'w-32 h-32 sm:w-36 sm:h-36' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="80" cy="80" r="72" fill="#FDF1EC" className="dark:fill-[#341C16]/40" />
      <circle cx="80" cy="80" r="54" fill="#FFF9F2" className="dark:fill-slate-850" />
      
      {/* Open Book */}
      <path
        d="M40 100 C55 92 70 94 80 102 C90 94 105 92 120 100 L120 114 C105 106 90 108 80 116 C70 108 55 106 40 114 Z"
        fill="#FFFFFF"
        stroke="#EBE3D8"
        strokeWidth="1.5"
        className="dark:fill-slate-800 dark:stroke-slate-700"
      />
      {/* Book lines */}
      <line x1="48" y1="102" x2="72" y2="102" stroke="#F4A261" strokeWidth="2" strokeLinecap="round" />
      <line x1="48" y1="108" x2="68" y2="108" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="88" y1="102" x2="112" y2="102" stroke="#3D8A78" strokeWidth="2" strokeLinecap="round" />
      <line x1="88" y1="108" x2="108" y2="108" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />

      {/* Graduation Cap Motif */}
      <path d="M56 64 L80 50 L104 64 L80 76 Z" fill="#E05D38" />
      <path d="M64 68 V78 C64 84 96 84 96 78 V68" stroke="#E05D38" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="104" y1="64" x2="104" y2="82" stroke="#F4A261" strokeWidth="2" strokeLinecap="round" />
      <circle cx="104" cy="82" r="2.5" fill="#F4A261" />

      {/* Star sparkle */}
      <path d="M125 45 L128 52 L135 55 L128 58 L125 65 L122 58 L115 55 L122 52 Z" fill="#F4A261" />
      <path d="M35 55 L37 60 L42 62 L37 64 L35 69 L33 64 L28 62 L33 60 Z" fill="#3D8A78" />
    </svg>
  </div>
);

/**
 * Instructor Studio Hero Motif
 */
export const InstructorHeroIllustration = ({ className = 'w-32 h-32 sm:w-36 sm:h-36' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="80" cy="80" r="72" fill="#EEF6F4" className="dark:fill-[#132B25]/40" />
      <circle cx="80" cy="80" r="54" fill="#FFF9F2" className="dark:fill-slate-850" />

      {/* Clipboard / Assessment Rubric */}
      <rect x="48" y="40" width="64" height="82" rx="10" fill="#FFFFFF" stroke="#EBE3D8" strokeWidth="1.5" className="dark:fill-slate-800 dark:stroke-slate-700" />
      <rect x="65" y="34" width="30" height="10" rx="4" fill="#3D8A78" />

      {/* Checklist items */}
      <circle cx="60" cy="60" r="4.5" fill="#EEF6F4" />
      <path d="M58 60 L59.5 61.5 L62 58.5" stroke="#3D8A78" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="68" y="58" width="34" height="4" rx="2" fill="#94A3B8" />

      <circle cx="60" cy="76" r="4.5" fill="#EEF6F4" />
      <path d="M58 76 L59.5 77.5 L62 74.5" stroke="#3D8A78" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="68" y="74" width="28" height="4" rx="2" fill="#94A3B8" />

      <circle cx="60" cy="92" r="4.5" fill="#FEF5ED" />
      <circle cx="60" cy="92" r="1.5" fill="#F4A261" />
      <rect x="68" y="90" width="32" height="4" rx="2" fill="#CBD5E1" />

      {/* Fountain Pen Tool */}
      <g transform="translate(100, 75) rotate(45)">
        <rect x="0" y="0" width="10" height="34" rx="3" fill="#E05D38" />
        <path d="M0 34 L5 44 L10 34 Z" fill="#1F2937" />
        <line x1="5" y1="36" x2="5" y2="42" stroke="#FFFFFF" strokeWidth="1" />
      </g>
    </svg>
  </div>
);

/**
 * Admin Governance Hero Motif
 */
export const AdminHeroIllustration = ({ className = 'w-32 h-32 sm:w-36 sm:h-36' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="80" cy="80" r="72" fill="#FDF1EC" className="dark:fill-[#341C16]/40" />
      <circle cx="80" cy="80" r="54" fill="#FFF9F2" className="dark:fill-slate-850" />

      {/* Institutional Shield */}
      <path
        d="M80 40 L112 52 V80 C112 98 98 114 80 120 C62 114 48 98 48 80 V52 Z"
        fill="#FFFFFF"
        stroke="#E05D38"
        strokeWidth="2.5"
        className="dark:fill-slate-800"
      />
      {/* Inner Accent */}
      <path
        d="M80 50 L102 59 V78 C102 91 93 103 80 108 C67 103 58 91 58 78 V59 Z"
        fill="#FDF1EC"
        className="dark:fill-slate-750"
      />
      {/* Institutional Key/Check */}
      <path d="M72 78 L78 84 L88 72" stroke="#3D8A78" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/**
 * Empty State Illustration
 */
export const EmptyStateIllustration = ({ className = 'w-24 h-24' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="60" cy="60" r="52" fill="#FFF4EB" className="dark:fill-slate-800" />
      
      {/* Floating Document with soft pages */}
      <rect x="36" y="32" width="48" height="58" rx="8" fill="#FFFFFF" stroke="#EBE3D8" strokeWidth="1.5" className="dark:fill-slate-750 dark:stroke-slate-600" />
      <rect x="44" y="44" width="22" height="4" rx="2" fill="#F4A261" />
      <rect x="44" y="54" width="32" height="3" rx="1.5" fill="#CBD5E1" className="dark:fill-slate-600" />
      <rect x="44" y="62" width="26" height="3" rx="1.5" fill="#CBD5E1" className="dark:fill-slate-600" />
      <rect x="44" y="70" width="18" height="3" rx="1.5" fill="#CBD5E1" className="dark:fill-slate-600" />

      {/* Sparkles */}
      <circle cx="88" cy="38" r="3" fill="#3D8A78" />
      <circle cx="32" cy="74" r="2.5" fill="#E05D38" />
    </svg>
  </div>
);

/**
 * 404 / Lost Path Illustration
 */
export const NotFoundIllustration = ({ className = 'w-56 h-56' }) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="120" cy="120" r="100" fill="#FFF9F2" className="dark:fill-slate-850" />
      <circle cx="120" cy="120" r="80" fill="#FDF1EC" className="dark:fill-slate-800" />

      {/* Floating 404 Clouds */}
      <path
        d="M50 170 C50 150 70 140 90 150 C110 135 140 140 150 160 C170 150 195 165 190 185 L50 185 Z"
        fill="#FFFFFF"
        className="dark:fill-slate-700/50"
      />

      {/* Whimsical Compass / Map Pin */}
      <g transform="translate(100, 70)">
        <path
          d="M20 0 C9 0 0 9 0 20 C0 35 20 56 20 56 C20 56 40 35 40 20 C40 9 31 0 20 0 Z"
          fill="#E05D38"
        />
        <circle cx="20" cy="20" r="8" fill="#FFFFFF" />
        <circle cx="20" cy="20" r="4" fill="#F4A261" />
      </g>

      {/* Paper Plane circling */}
      <g transform="translate(160, 60) rotate(-20)">
        <path d="M0 12 L22 0 L14 19 L8 13 Z" fill="#3D8A78" />
      </g>
    </svg>
  </div>
);
