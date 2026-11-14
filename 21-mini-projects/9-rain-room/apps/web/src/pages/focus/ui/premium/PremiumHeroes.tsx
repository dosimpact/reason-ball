export function SleepingDragon() {
  return (
    <g data-premium-hero="sleeping-dragon">
      <ellipse cx="598" cy="771" rx="185" ry="40" fill="#53624a" />
      <path
        d="M758 735q30-105-58-163-100-55-171 36-58 65-1 126 71 70 157 9 43-36 2-72-36-26-56 8 33-17 40 9 9 26-41 28-69-2-59-64 6-63 75-54 85 12 72 93z"
        fill="#788a68"
        stroke="#a8ae81"
        strokeWidth="4"
      />
      <path
        d="M627 591q-74-78-134-89l27 63-55-18 30 42-37 7 68 36z"
        fill="#536d56"
        stroke="#9aab80"
        strokeWidth="4"
      />
      <path
        d="M534 671q-24-72-87-49-47 10-42 52l-39 22q1 35 62 30l70-11q45-3 36-44z"
        fill="#879977"
        stroke="#b1b589"
        strokeWidth="4"
      />
      <path
        d="M440 634l-9-42 30 29m28 10 16-32 7 46"
        fill="#c1b58a"
        stroke="#a8a57d"
        strokeWidth="3"
      />
      <path
        d="M424 676q13 8 26-3m-68 25 17 2"
        stroke="#354c41"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M550 711q-25 34-63 32l-9 24 77-2 32-31m75-17 4 32 65 9"
        fill="#829471"
        stroke="#a3ad7c"
        strokeWidth="5"
      />
      <path d="M606 596 594 577l27 8 4-24 23 27 14-20 15 33 22-10 1 32" fill="#b8b98b" />
      <path
        d="M566 649q85-42 141 23m-132-4q75-32 126 23m-116-5q60-20 111 24"
        stroke="#596f54"
        strokeWidth="3"
        fill="none"
        opacity=".6"
      />
    </g>
  )
}
export function LegendaryForeground({ spaceId }: { spaceId: string }) {
  if (spaceId === 'premium-underwater-library')
    return (
      <g data-premium-hero="pressure-archive">
        <path
          d="M665 230q95-35 120 55v390q-65 45-125-5V285q0-33 5-55z"
          fill="#345a60"
          stroke="#93b1a2"
          strokeWidth="10"
        />
        <ellipse
          cx="722"
          cy="418"
          rx="45"
          ry="100"
          fill="#1c414d"
          stroke="#9eb5a3"
          strokeWidth="10"
        />
        <ellipse cx="722" cy="418" rx="29" ry="78" fill="#497985" />
        <path d="M722 388v60m-24-30h48" stroke="#afc1a8" strokeWidth="8" />
        <circle cx="722" cy="418" r="12" fill="#456c70" />
        <path
          d="M12 270q55-35 105 0v330q-55 35-105 0z"
          fill="#385e60"
          stroke="#9eb1a0"
          strokeWidth="7"
        />
        {[315, 390, 465, 540].map((y) => (
          <g key={y}>
            <path d={`M12 ${y}q50 24 105 0`} stroke="#c3c0a0" strokeWidth="5" />
            {[24, 44, 64, 84].map((x, i) => (
              <path
                key={x}
                d={`M${x} ${y - 43}v42`}
                stroke={i % 2 ? '#a09478' : '#708f83'}
                strokeWidth="13"
              />
            ))}
          </g>
        ))}
      </g>
    )
  if (spaceId === 'premium-memory-house')
    return (
      <g data-premium-hero="memory-workshop">
        <path d="M445 729h305l-18 91H460z" fill="#765f48" stroke="#b69c70" strokeWidth="6" />
        <path d="M445 729q150-100 305 0" fill="#8f7757" stroke="#b69c70" strokeWidth="7" />
        <path d="M480 716v100m230-100v100" stroke="#433f34" strokeWidth="12" />
        <path d="M570 755h50v27h-50z" fill="#b9a477" />
        <path
          d="M341 632h135v16H341zM365 632v-79q0-18 20-18h58q23 0 23 24v32h-24v-29h-48v70z"
          fill="#3f514a"
          stroke="#b1a280"
          strokeWidth="4"
        />
        <circle cx="469" cy="572" r="25" fill="#536159" stroke="#b6a981" strokeWidth="5" />
        <path d="M370 600v31m-10-1h30" stroke="#d4c7a1" strokeWidth="3" />
        <path d="M392 636q-18-22-57-13l-17 40 77 3z" fill="#aa8f83" />
        <path d="M45 540h110v110H45z" fill="#6f6047" stroke="#b29d75" strokeWidth="4" />
        <path d="M55 550h90v90H55z" fill="#9b8c6b" />
        <path d="m64 619 29-46 35 46" fill="#667b6a" />
      </g>
    )
  return null
}

export function ThemeMachine({ spaceId }: { spaceId: string }) {
  if (spaceId === 'premium-moon-alchemy')
    return (
      <g data-premium-hero="retort-laboratory" stroke="#b5b68e" strokeWidth="5" fill="none">
        <path d="M225 661V411q0-45 45-45h45q45 0 45 45v45" stroke="#bba478" strokeWidth="11" />
        <path d="M235 660h225v22H235z" fill="#667b70" />
        <path
          d="M264 394h46v70q64 20 63 76-3 58-74 58-71 0-72-58 0-56 37-76z"
          fill="#6f9184"
          fillOpacity=".5"
        />
        <path d="M240 536q58-15 118 0v27q-59 29-118 0z" fill="#a6b780" stroke="none" opacity=".7" />
        <path
          d="M309 397q100-32 128 14v99q-1 24-26 24h-40m48-112v89"
          stroke="#b7c4a4"
          strokeWidth="8"
        />
        <path d="M255 612h90l-15 32h-60z" fill="#8c8d68" />
        <path d="M285 624q-15-20 7-38 21 18 4 38" fill="#d9bc73" stroke="none" />
        <path d="M247 659V469m-14 0h49m155-44h31v234m-18-185h40" stroke="#9f9a74" />
      </g>
    )
  if (spaceId === 'premium-wizard-library')
    return (
      <g data-premium-hero="orrery-bracket">
        <path
          d="M605 438h90v13h-90zM620 451l30 45 30-45"
          fill="#9b8a64"
          stroke="#b6a67e"
          strokeWidth="4"
        />
        <path
          d="M135 690q-90-180 0-340m-20 110 95-20m-98 100 95-20m-95 100 95-20"
          fill="none"
          stroke="#8d8164"
          strokeWidth="14"
        />
      </g>
    )
  return null
}
