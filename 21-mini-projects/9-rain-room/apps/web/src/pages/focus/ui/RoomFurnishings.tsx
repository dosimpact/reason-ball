/** Indoor objects render after the window and floor, before people and the near table. */
export default function RoomFurnishings({ scene }: { scene: number }) {
  if (scene === 8)
    return (
      <g data-furnishing="work-monitor">
        <path d="M310 485h150v105H310z" fill="#172a2b" stroke="#8a9380" strokeWidth="6" />
        <path d="M320 495h130v82H320z" fill="#314b49" />
        <path d="M385 591v14m-24 2h48" stroke="#9b9b83" strokeWidth="6" strokeLinecap="round" />
        <path d="M334 551h34m-34 9h62" stroke="#a7b99e" opacity=".16" strokeWidth="2" />
      </g>
    )
  if (scene === 22)
    return (
      <g data-furnishing="camper-dashboard">
        <path d="M70 583q330-32 660 0v30q-330-24-660 0z" fill="#4f5144" />
        <path d="M92 585q308-25 616 0" fill="none" stroke="#92917a" strokeWidth="3" opacity=".55" />
        <path d="M142 594h55m-55 5h55m404-5h55m-55 5h55" stroke="#232e2a" strokeWidth="3" />
        <path d="M400 116v57" stroke="#53584b" strokeWidth="5" />
        <rect
          x="371"
          y="173"
          width="58"
          height="22"
          rx="7"
          fill="#202f2e"
          stroke="#797e6d"
          strokeWidth="3"
        />
        <path d="M380 181h39" stroke="#90a49b" strokeWidth="2" opacity=".4" />
      </g>
    )
  if (scene === 24)
    return (
      <g data-furnishing="observatory-telescope" transform="translate(-170 0)">
        <path
          d="M625 550v31m0-10-57 219m57-219 67 219m-67-219 7 233"
          fill="none"
          stroke="#9a9c85"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="M607 552h36v21h-36z" fill="#5e726c" />
        <path d="M601 500L625 534" stroke="#747f71" strokeWidth="13" strokeLinecap="round" />
        <circle cx="601" cy="500" r="10" fill="#65776b" />
        <path d="m548 414 88 67-23 34-89-65z" fill="#9da99a" stroke="#586f6a" strokeWidth="3" />
        <path d="m624 487 28 20-9 13-29-19" fill="#526b68" />
        <path d="m642 513 15 10" stroke="#b0b5a0" strokeWidth="6" strokeLinecap="round" />
        <ellipse
          cx="537"
          cy="432"
          rx="16"
          ry="24"
          transform="rotate(38 537 432)"
          fill="#263f45"
          stroke="#bdc6b3"
          strokeWidth="5"
        />
        <path d="m530 418 10 7" stroke="#89b0b3" strokeWidth="3" opacity=".7" />
        <path d="M604 526q23-12 32 4v21h-32z" fill="#747f71" />
      </g>
    )
  return null
}
