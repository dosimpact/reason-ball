import LegacyOutdoorFixtures from './LegacyOutdoorFixtures'
/** Five additional window views; the original thirty scenes retain their geometry. */
export default function SongInspiredArt({ scene }: { scene: number }) {
  switch (scene) {
    case 30:
      return (
        <g data-song-scene="linen">
          <path d="M0 355q170-50 340 15t460-30v480H0z" fill="#39574b" />
          <path d="M0 445q210-60 420 0t380-20v395H0z" fill="#2b443b" />
        </g>
      )
    case 31:
      return (
        <g data-song-scene="pine-fireflies">
          <path d="M0 330q220-100 420-5t380-20v515H0z" fill="#244740" />
          {[85, 230, 560, 705].map((x, index) => (
            <g key={x}>
              <path d={`M${x} ${180 + (index % 2) * 50}v470`} stroke="#35594b" strokeWidth="15" />
              <path
                d={`M${x} ${95 + (index % 2) * 50}l-90 180h55l-92 145h65l-95 140h314l-95-140h65l-92-145h55z`}
                fill={index % 2 ? '#2d5c4c' : '#3d6a58'}
              />
            </g>
          ))}
          <path d="M0 480q240-80 470-10t330-15v365H0z" fill="#1c3d35" />
          <LegacyOutdoorFixtures scene={31} />
          <path
            d="M270 570q80-65 180-70"
            fill="none"
            stroke="#6c7560"
            strokeWidth="12"
            opacity=".45"
          />
        </g>
      )
    case 32:
      return (
        <g data-song-scene="granite">
          <path d="M0 430 130 250l100 95 190-210 150 185 105-80 125 190v390H0z" fill="#4d5b5b" />
          <path d="m240 405 180-270-52 209 91 44-70 50z" fill="#6b7771" />
          <path d="m485 433 190-193-50 186 125 85z" fill="#66736d" />
          <path d="M0 525q240-95 460-10t340-25v330H0z" fill="#2c4543" />
          <path d="M62 80h110v500H62zM628 80h110v500H628z" fill="#74756a" />
          <path
            d="m64 180 106 16M64 315l106-24m-106 180 106 5m460-290 106-9m-106 150 106 19m-106 112 106-17"
            stroke="#a09d86"
            strokeWidth="3"
            opacity=".6"
          />
          <path
            d="m94 100 32 78-24 72 33 80-31 91 30 80M691 100l-21 86 24 82-26 84 25 104"
            fill="none"
            stroke="#4c5750"
            strokeWidth="3"
            opacity=".65"
          />
          <path
            d="M213 531 243 503l35 35-7 38h-70zM525 546l30-29 41 22 12 40h-85z"
            fill="#788274"
          />
        </g>
      )
    case 33:
      return (
        <g data-song-scene="deep-harbor">
          <path d="M0 220h800v600H0z" fill="#123c45" />
          <path d="M0 380q400-24 800 0v440H0z" fill="#174953" />
          {[130, 210, 305, 410, 570, 685].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} ${260 + (i % 3) * 22}v120m-30-70 60-15`}
                stroke="#284c4e"
                strokeWidth="4"
              />
              <circle cx={x} cy={288 + (i % 3) * 22} r="4" fill={i % 2 ? '#b9c8a0' : '#c6a66b'} />
              <path
                d={`M${x} 402v${45 + (i % 3) * 25}`}
                stroke="#b8be8e"
                strokeWidth="5"
                opacity=".17"
              />
            </g>
          ))}
          <path d="m90 370 58 4 30 16h-98zM500 370l89-4 33 24H487z" fill="#203b3c" />
          <path
            d="M0 465q140-20 280 0t300 0 220 0m-760 40q220-22 400 0t320-3m-670 41q190-20 350-2"
            stroke="#5b8c8b"
            strokeWidth="2"
            opacity=".3"
            fill="none"
          />
          <path d="M650 356v-90h33v90z" fill="#647f76" />
          <path d="m644 266 22-18 23 18z" fill="#8e8f70" />
          <path d="M658 278h17v12h-17z" fill="#d5c58d" />
        </g>
      )
    default:
      return (
        <g data-song-scene="velvet-tide">
          <path d="M0 280q400 20 800 0v540H0z" fill="#486665" />
          <path
            d="M0 355q210 8 430-7t370 4m-800 72q160-18 340 0t460-3m-760 79q180-14 380 2t350-4"
            stroke="#a5b6a4"
            strokeWidth="4"
            opacity=".35"
            fill="none"
          />
          <path d="M0 535q200-65 400-9t400-22v316H0z" fill="#6a7563" />
        </g>
      )
  }
}

/** Interior textiles stay in front of the window rather than looking like objects outside. */
export function SongInspiredFurnishings({ scene }: { scene: number }) {
  if (scene === 30)
    return (
      <g data-song-furnishing="linen-curtains">
        {' '}
        <path
          d="M50 80q55 18 108 0l-9 475-96 12zM642 80q54 18 108 0l-3 486-102-16z"
          fill="#aca083"
        />
        <path
          d="M64 90q8 220 0 454m28-452q-8 225 0 455m29-457q8 210-2 450m548-450q8 219 0 456m30-455q-7 240 2 450m30-452q10 229 0 458"
          fill="none"
          stroke="#d1c5a4"
          strokeWidth="3"
          opacity=".4"
        />
        <path
          d="M50 447q49 21 103 0m490 0q50 21 105 0"
          stroke="#6f7757"
          strokeWidth="10"
          fill="none"
        />
      </g>
    )
  if (scene !== 34) return null
  return (
    <g data-song-furnishing="velvet-armchair">
      <path d="M75 637V541q0-32 30-32h60q30 0 30 32v96z" fill="#766e60" />
      <path d="M85 575q50-20 100 0v46H85z" fill="#a4977b" />
      <path
        d="M74 565q-13 0-13 14v60h30v-61q0-13-17-13m123 0q13 0 13 14v60h-30v-61q0-13 17-13"
        fill="#8e806b"
      />
      <path d="M96 581q25 7 50-2l7 77q-25 12-52 0z" fill="#b2a082" />
      <path
        d="M105 592l39-3m-38 17 39-3m-38 17 39-3m-38 17 39-3"
        fill="none"
        stroke="#d3c3a1"
        strokeWidth="2"
        opacity=".65"
      />
      <path d="M81 640v40m108-40v40" stroke="#514735" strokeWidth="8" />
    </g>
  )
}
