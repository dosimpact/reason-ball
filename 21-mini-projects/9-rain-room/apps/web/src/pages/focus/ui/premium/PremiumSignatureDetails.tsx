import { useId, type CSSProperties } from 'react'
import { getPremiumExperience, type PremiumMotion } from '../../model/premiumExperience'
import { premiumGeometry } from './premiumGeometry'
import './premium-signatures.css'

/** Local origin is the stationary lantern head, world(600,205) in the storm room. */
function LighthouseBeacon() {
  const uid = `coastal-beacon-${useId().replace(/:/g, '')}`
  return (
    <g data-lighthouse-beacon="lantern-and-sea">
      <defs>
        <linearGradient
          id={`${uid}-reach`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="-650"
          y2="0"
        >
          <stop stopColor="#f2e3ab" stopOpacity=".42" />
          <stop offset=".18" stopColor="#e7dba5" stopOpacity=".24" />
          <stop offset=".62" stopColor="#d7d3a2" stopOpacity=".12" />
          <stop offset="1" stopColor="#d7d3a2" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${uid}-feather`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="-110"
          x2="0"
          y2="110"
        >
          <stop stopColor="#ffffff" stopOpacity="0" />
          <stop offset=".38" stopColor="#ffffff" stopOpacity=".8" />
          <stop offset=".5" stopColor="#ffffff" />
          <stop offset=".62" stopColor="#ffffff" stopOpacity=".8" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask
          id={`${uid}-soft`}
          maskUnits="userSpaceOnUse"
          x="-660"
          y="-115"
          width="670"
          height="230"
        >
          <rect x="-660" y="-115" width="670" height="230" fill={`url(#${uid}-feather)`} />
        </mask>
        <radialGradient id={`${uid}-water`}>
          <stop stopColor="#d9d6a5" stopOpacity=".22" />
          <stop offset="1" stopColor="#d9d6a5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="premium-beacon-sweep">
        <path
          d="M0-4C-210-21-450-74-650-110V110C-450 74-210 21 0 4Z"
          fill={`url(#${uid}-reach)`}
          mask={`url(#${uid}-soft)`}
        />
      </g>
      <g transform="translate(-190 205)">
        <g className="premium-beacon-reflection">
          <ellipse rx="122" ry="29" fill={`url(#${uid}-water)`} />
          <path
            d="M-77-9q77-7 154 0m-122 15q45-5 90 0m-74 14q29-4 58 0"
            fill="none"
            stroke="#d9d3a0"
            strokeWidth="3"
            opacity=".28"
          />
        </g>
      </g>
      <g className="premium-beacon-lens">
        <circle r="15" fill="#d6d8ad" opacity=".5" />
        <path d="M-14 0Q0-20 14 0Q0 20-14 0Z" fill="#ecdfac" opacity=".72" />
        <path d="M0-16v32M-16 0h32" fill="none" stroke="#e8dfb1" strokeWidth="2" />
        <path d="M-7-10 7 10" fill="none" stroke="#9eae98" strokeWidth="3" />
      </g>
      <path
        d="M-14-22v44m28-44v44M-24-24h48m-48 48h48"
        fill="none"
        stroke="#aeb798"
        strokeWidth="2.5"
      />
    </g>
  )
}

/** Small mechanical and natural stories, authored in the scene's 800×820 coordinate system. */
function Subject({ kind }: { kind: string }) {
  const brass = '#c5a776'
  const ink = '#34464b'
  if (kind === 'beacon') return <LighthouseBeacon />
  if (kind === 'antenna' || kind === 'satellite')
    return (
      <>
        <path d="M0 36V-8M-24 36H24" stroke="#a1b7ab" strokeWidth="5" />
        <g className="signature-needle">
          <path d="M-30-25Q0 16 30-25Z" fill="#8fa5a0" stroke="#c5d1bd" strokeWidth="2" />
          <path d="M0-5V-35" stroke={brass} strokeWidth="3" />
          <circle cy="-35" r="4" fill="#c9ba8b" />
        </g>
        {kind === 'satellite' && (
          <path d="M-65-23H-35V9H-65ZM35-23H65V9H35Z" fill="#597f8d" stroke="#9cb1a5" />
        )}
      </>
    )
  if (kind === 'shutter')
    return (
      <>
        <path d="M-48-22H48V29H-48Z" fill="#4a5557" stroke="#aab7aa" strokeWidth="4" />
        <g className="signature-current">
          <path
            d="M-40-16H-5V22H-40ZM5-16H40V22H5Z"
            fill="#809294"
            stroke="#adb7a6"
            strokeWidth="2"
          />
        </g>
        <path d="M-48-29H48" stroke={brass} strokeWidth="5" />
      </>
    )
  if (kind === 'bridge')
    return (
      <>
        <path d="M-65-35V45M65-35V45" stroke="#736c50" strokeWidth="7" />
        <g className="signature-sway">
          <path
            d="M-65-20Q0 15 65-20M-65 20Q0 55 65 20"
            fill="none"
            stroke="#b1a27d"
            strokeWidth="4"
          />
          {[-45, -22, 0, 22, 45].map((x) => (
            <path key={x} d={`M${x} ${-8 + Math.abs(x) / 5}v40`} stroke="#9b8a66" strokeWidth="3" />
          ))}
        </g>
      </>
    )
  if (kind === 'ribbon')
    return (
      <>
        <path d="M-30-15H30V30H-30Z" fill="#8d5b53" stroke="#bea073" />
        <path d="M-4-15H4V30H-4Z" fill="#c2ae7d" />
        <g className="signature-sway">
          <path
            d="M0-15Q-28-39-30-18T0-15Q28-39 30-18T0-15M0-15-12 11M0-15 15 13"
            fill="none"
            stroke="#d1b980"
            strokeWidth="5"
          />
        </g>
      </>
    )
  if (kind === 'sax')
    return (
      <g className="signature-swing">
        <path
          d="M-10-36H8V10Q30 8 22-10L37-17Q54 25 11 32Q-9 31-9 12Z"
          fill="#b39a64"
          stroke="#d1b37c"
          strokeWidth="2"
        />
        <path d="M-3-27V12" stroke="#655d45" strokeWidth="3" />
        {[-15, -3, 9].map((y) => (
          <circle key={y} cx="-3" cy={y} r="3" fill="#dfc68c" />
        ))}
      </g>
    )
  if (kind === 'ember')
    return (
      <>
        <path d="M-28 27H28L20 38H-20Z" fill="#4b4d41" stroke={brass} />
        <g className="signature-sway">
          <path d="M-17 24Q-24 5-8-8Q-9 7 3-21Q26 5 17 24Z" fill="#b98d61" />
          <path d="M-7 24Q-11 11 3 0Q2 12 10 24Z" fill="#dac091" />
        </g>
      </>
    )
  if (kind === 'squirrel')
    return (
      <>
        <g className="signature-sway">
          <path
            d="M-15 14Q-56 18-46-20Q-40-45-22-35Q-13-24-27-15Q-39-4-15 0Z"
            fill="#ac9270"
            stroke="#c2a781"
            strokeWidth="2"
          />
        </g>
        <ellipse cx="0" cy="11" rx="19" ry="13" fill="#aa8c67" />
        <circle cx="16" cy="-2" r="12" fill="#aa8c67" />
        <path
          d="M10-11 11-23 20-12M-10 20-15 28M9 20 15 27"
          stroke="#b69c76"
          strokeWidth="5"
          fill="none"
        />
        <circle cx="21" cy="-4" r="2" fill="#25382f" />
        <path d="M27 0 32 3 26 5" fill="#644f3b" />
      </>
    )
  if (kind === 'bird')
    return (
      <>
        <ellipse cy="8" rx="22" ry="14" fill="#9da98d" />
        <g className="signature-needle">
          <circle cx="16" cy="-7" r="12" fill="#b9b99a" />
          <path d="M25-8 36-4 25 0" fill="#c3a370" />
          <circle cx="20" cy="-10" r="2" fill="#253b35" />
        </g>
        <path
          d="M-18 10-37 18-24 21M-4 19-5 27M8 19 9 27"
          stroke="#9c9877"
          strokeWidth="3"
          fill="none"
        />
        <path d="M-13 3Q1-1 10 12Q-8 19-13 3" fill="#64877e" />
      </>
    )
  if (kind === 'firefly' || kind === 'seed' || kind === 'spore')
    return (
      <g className="signature-drift">
        {[-18, 0, 19].map((x, i) => (
          <g key={x} transform={`translate(${x} ${(i % 2) * 19})`}>
            <ellipse rx="4" ry="7" fill={kind === 'firefly' ? '#d5d498' : '#b9bd95'} />
            <path d="M0-3Q-22-20-18-5L0 2Q22-20 18-5Z" fill="#91ad9b" opacity=".65" />
            {kind === 'seed' && <path d="M0 7V22" stroke="#b7b79a" />}
          </g>
        ))}
      </g>
    )
  if (kind === 'flower')
    return (
      <>
        <path d="M0 36V-8" stroke="#839a6c" strokeWidth="4" />
        <g className="signature-wing">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} transform={`rotate(${a})`} cy="-14" rx="9" ry="17" fill="#c0a39a" />
          ))}
          <circle r="9" fill="#ceb584" />
        </g>
      </>
    )
  if (kind === 'calendar')
    return (
      <>
        <path d="M-30-32H30V36H-30Z" fill="#6c6150" stroke={brass} strokeWidth="3" />
        <path d="M-23-23H23V28H-23Z" fill="#d2c5a7" />
        <path d="M-14-38V-22M14-38V-22" stroke="#c7b58f" strokeWidth="4" />
        <g className="signature-page">
          <path d="M-22-17H22V26H-22Z" fill="#d9ceb3" />
          <path d="M-16-9H16M-16 0H16M-16 9H16M-8-12V19M3-12V19M13-12V19" stroke="#9a8d73" />
        </g>
      </>
    )
  if (kind === 'envelope' || kind === 'paper')
    return (
      <g className="signature-page">
        <path d="M-34-19H34V24H-34Z" fill="#c2b495" stroke="#8c7b5e" strokeWidth="2" />
        <path
          d="M-34-19 0 5 34-19M-34 24-10 3M34 24 10 3"
          fill="none"
          stroke="#8c7b5e"
          strokeWidth="2"
        />
        <circle cy="5" r="5" fill="#a46b57" />
      </g>
    )
  if (kind === 'star')
    return (
      <g className="signature-spin">
        <path
          d="M0-33 9-11 33-10 16 6 21 31 0 18-21 31-16 6-33-10-9-11Z"
          fill="#baa97a"
          stroke="#dfd0a0"
          strokeWidth="2"
        />
        <circle r="6" fill="#d8ca97" />
      </g>
    )
  if (kind === 'leaf')
    return (
      <g className="signature-drift">
        <path
          d="M0 30 0 13-24 17-16 2-32-9-12-12-13-30 0-17 13-30 12-12 32-9 16 2 24 17 0 13"
          fill="#ab7b57"
          stroke="#ca9b6a"
          strokeWidth="2"
        />
        <path d="M0 24V-18M0 9-17-4M0 9 17-4" stroke="#715e45" />
      </g>
    )
  if (kind === 'fan')
    return (
      <g className="signature-swing">
        <path d="M0 30-46-5Q0-58 46-5Z" fill="#b5a281" stroke="#d2be96" strokeWidth="2" />
        {[-34, -17, 0, 17, 34].map((x) => (
          <path
            key={x}
            d={`M0 30 ${x} ${-25 + Math.abs(x) / 3}`}
            stroke="#796d53"
            strokeWidth="2"
          />
        ))}
        <circle cy="30" r="4" fill="#d0b582" />
      </g>
    )
  if (kind === 'landscape')
    return (
      <g className="signature-travel">
        <path d="M0-90V72M-30-65H30M-24-30H24" stroke="#839584" strokeWidth="7" />
        <path d="M-25-69V-54M25-69V-54M-19-34V-19M19-34V-19" stroke="#c1b894" strokeWidth="3" />
        <path d="M-65-60Q0-35 65-60M-65-25Q0 0 65-25" fill="none" stroke="#8a9c8c" />
      </g>
    )
  if (kind === 'ticket')
    return (
      <g className="signature-page">
        <path d="M-31-15H31V15H-31Z" fill="#c9bd9e" stroke="#9f8e6e" />
        <path d="M12-12V12M-22-6H5M-22 1H5M-22 7H0" stroke="#7a745e" />
        <circle cx="21" r="5" fill="none" stroke="#a58861" />
      </g>
    )
  if (kind === 'tag')
    return (
      <>
        <path d="M0-50V-15" stroke="#ac9b77" />
        <g className="signature-swing">
          <path d="M-17-11 0-21 17-11V25H-17Z" fill="#b49a74" stroke="#d0b98e" />
          <circle cy="-12" r="3" fill="#6a634d" />
          <path d="M-10 1H10M-10 9H10M-10 17H4" stroke="#786b51" />
        </g>
      </>
    )
  if (kind === 'rope')
    return (
      <>
        <path d="M0-58V-25" stroke="#b6a17c" strokeWidth="5" />
        <g className="signature-sway">
          <ellipse rx="23" ry="34" fill="none" stroke="#b2a17b" strokeWidth="8" />
          <ellipse rx="14" ry="25" fill="none" stroke="#82775b" strokeWidth="4" />
          <path d="M7 26 19 48" stroke="#b2a17b" strokeWidth="5" />
        </g>
      </>
    )
  if (kind === 'pulley')
    return (
      <>
        <circle cy="-25" r="16" fill="#736b51" stroke="#c2af85" strokeWidth="4" />
        <path d="M-14-25V38M14-25V47" stroke="#b0a17c" strokeWidth="3" />
        <g className="signature-stamp">
          <path d="M-35 26H7L2 58H-30Z" fill="#987c58" stroke="#c2aa80" />
          <path d="M-28 30V53M-18 30V55M-8 30V53" stroke="#6e6147" />
        </g>
      </>
    )
  if (kind === 'vane')
    return (
      <>
        <path d="M0 38V-27" stroke="#a6a585" strokeWidth="4" />
        <g className="signature-needle">
          <path d="M-42-12H36L22-24M36-12 22 0" stroke="#c8b581" strokeWidth="4" fill="none" />
          <path d="M-40-12-22-27V3Z" fill="#8aa194" />
        </g>
      </>
    )
  if (kind === 'ribbonwind')
    return (
      <>
        <path d="M-38 45V-40" stroke="#a7a88a" strokeWidth="4" />
        <g className="signature-sway">
          <path d="M-38-35Q-8-40 17-24L37-20 17-8Q-9-17-38-12Z" fill="#a98e70" stroke="#cbb58a" />
          <path d="M-20-36V-12M0-31V-10M20-25V-10" stroke="#ded0a4" />
        </g>
      </>
    )
  if (kind === 'mobile')
    return (
      <>
        <path d="M-40-35H40M-30-35V8M0-35V20M30-35V4" stroke="#b5a482" strokeWidth="2" />
        <g className="signature-swing">
          {[-30, 0, 30].map((x, i) => (
            <g key={x} transform={`translate(${x} ${(i % 2) * 14})`}>
              <path d="M-12 4H12V28H-12Z" fill="#bca985" stroke="#d4bd91" strokeWidth="2" />
              <path d="M-8 23-2 13 4 21 8 16V24Z" fill="#68867a" />
            </g>
          ))}
        </g>
      </>
    )
  if (kind === 'reel')
    return (
      <>
        <path d="M-29 34H29V43H-29Z" fill="#655b49" stroke={brass} />
        <g className="signature-spin">
          <circle r="34" fill="#8f9a8b" stroke="#c3b68d" strokeWidth="3" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} transform={`rotate(${a})`} cy="-20" r="8" fill="#334b48" />
          ))}
          <circle r="5" fill="#d2bc8c" />
        </g>
      </>
    )
  if (kind === 'musicbox')
    return (
      <>
        <path d="M-33 8H33V32H-33Z" fill="#967351" stroke="#c3a67c" strokeWidth="2" />
        <ellipse cy="8" rx="33" ry="11" fill="#c4af88" />
        <g className="signature-spin">
          <path
            d="M0-8V-29M-16-20 0-13 16-23M0-8-12 6M0-8 12 6"
            fill="none"
            stroke="#bca58a"
            strokeWidth="4"
          />
          <circle cy="-36" r="7" fill="#d0ba9a" />
          <path d="M0-21-15-6H15Z" fill="#a5919d" />
        </g>
      </>
    )
  if (kind === 'coin')
    return (
      <g className="signature-needle">
        <circle r="16" fill="#b69a64" stroke="#ddc58e" strokeWidth="3" />
        <circle r="10" fill="none" stroke="#7d754c" />
        <path d="M-4-6H4V7H-4Z" fill="#d4bd7e" />
      </g>
    )
  if (kind === 'film')
    return (
      <>
        <path d="M-13-45H13V45H-13Z" fill="#4c5751" stroke="#bca77f" />
        <g className="signature-current">
          {[-33, -11, 11, 33].map((y) => (
            <g key={y}>
              <path d={`M-8 ${y - 8}H8V${y + 8}H-8Z`} fill="#82968c" />
              <path
                d={`M-12 ${y - 5}H-10M10 ${y - 5}H12M-12 ${y + 5}H-10M10 ${y + 5}H12`}
                stroke="#d4c8a4"
                strokeWidth="2"
              />
            </g>
          ))}
        </g>
      </>
    )
  if (kind === 'ray')
    return (
      <g className="signature-drift">
        <g className="signature-wing">
          <path
            d="M0-8Q-22-26-54-18L-38 8Q-20 23 0 11Q20 23 38 8L54-18Q22-26 0-8Z"
            fill="#709a9c"
            stroke="#a1b9aa"
            strokeWidth="2"
          />
        </g>
        <path d="M0 9Q8 34-10 55" fill="none" stroke="#8aa99f" strokeWidth="3" />
        <circle cx="-6" cy="-7" r="2" fill="#29474a" />
        <circle cx="6" cy="-7" r="2" fill="#29474a" />
      </g>
    )
  if (kind === 'butterfly' || kind === 'moth')
    return (
      <g className="signature-drift">
        <g className="signature-wing">
          <path
            d="M0 0Q-35-39-36-8Q-37 8-13 10Q-31 27-11 30L0 7M0 0Q35-39 36-8Q37 8 13 10Q31 27 11 30L0 7"
            fill={kind === 'moth' ? '#9b9a7d' : '#bc9c80'}
            stroke="#ceb995"
            strokeWidth="2"
          />
        </g>
        <path d="M0-8V16M0-8-7-20M0-8 7-20" stroke="#576653" strokeWidth="3" />
      </g>
    )
  if (kind === 'caravan')
    return (
      <g className="signature-travel">
        <path d="M-29 9Q-27-17-12-11Q-4-29 6-10L22-4 27-28 35-27 34 8 18 17H-23Z" fill="#9d8d6b" />
        <path
          d="M-20 15-23 35M-7 15-5 35M16 14 12 35M27 12 31 35"
          stroke="#a49370"
          strokeWidth="5"
        />
        <path d="M-14-10 9-8 12 12H-17Z" fill="#7e7860" />
        <path d="M34-20 43-18 34-14" fill="#9d8d6b" />
      </g>
    )
  if (kind === 'pendulum')
    return (
      <>
        <path
          d="M-27-39H27M-27 39H27M-22-37Q-22-12 0 0Q22 12 22 37M22-37Q22-12 0 0Q-22 12-22 37"
          stroke="#bda77f"
          strokeWidth="4"
          fill="none"
        />
        <path d="M-16-28H16L0-5Z" fill="#c3ab79" />
        <g className="signature-fall">
          <path d="M0-4V24" stroke="#dfc58c" strokeWidth="2" />
        </g>
        <path d="M-16 33 0 23 16 33Z" fill="#b49b6c" />
      </>
    )
  if (kind === 'bamboo')
    return (
      <>
        <path d="M-25 42H25M0 42V-4" stroke="#7b8e69" strokeWidth="6" />
        <g className="signature-needle">
          <path d="M-40-20 36-5 32 10-43-5Z" fill="#9baf7c" stroke="#c4ca96" strokeWidth="2" />
          <path d="M-20-15-22-1M8-10 6 5" stroke="#6f8c61" strokeWidth="3" />
        </g>
        <path d="M-50-48-48-27" stroke="#91aa88" strokeWidth="6" />
        <path d="M-48-27V-13" stroke="#bed0b2" strokeWidth="2" />
      </>
    )
  if (kind === 'stamp')
    return (
      <>
        <path d="M-32 29H32V36H-32Z" fill="#9b8060" />
        <g className="signature-stamp">
          <path d="M-21 7H21V16H-21Z" fill="#596c63" stroke={brass} />
          <path d="M-5-25H5V9H-5Z" fill="#aa8d62" />
          <ellipse cy="-25" rx="16" ry="9" fill="#876a4c" />
        </g>
      </>
    )
  if (kind === 'beans')
    return (
      <>
        <path d="M-20-39H20L10-8H-10Z" fill="#9fa58a" stroke="#c1ba95" strokeWidth="2" />
        <g className="signature-fall">
          {[-7, 7].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i * 12 - 6})`}>
              <ellipse rx="4" ry="7" fill="#9b7657" />
              <path d="M0-5Q-3 0 0 5" stroke="#604f3b" fill="none" />
            </g>
          ))}
        </g>
        <path d="M-23 27H23L17 37H-17Z" fill="#788375" stroke="#b3b497" />
      </>
    )
  if (kind === 'vent')
    return (
      <>
        <path d="M-37-37H37V37H-37Z" fill="#41565a" stroke="#96aaa0" strokeWidth="4" />
        <circle r="30" fill="#263e44" />
        <g className="signature-spin">
          {[0, 120, 240].map((a) => (
            <path
              key={a}
              transform={`rotate(${a})`}
              d="M0 0Q-20-13-11-26Q12-29 5-5Z"
              fill="#91a59b"
            />
          ))}
          <circle r="6" fill="#b9b995" />
        </g>
        <path d="M-30-30 30 30M-30 30 30-30" stroke="#6b8b84" strokeWidth="2" />
      </>
    )
  if (kind === 'scroll')
    return (
      <g className="signature-page">
        <path d="M-36-19H36V20H-36Z" fill="#c2ae83" stroke="#9e895f" />
        <ellipse cx="-36" rx="7" ry="23" fill="#d2bd91" stroke="#9e895f" />
        <ellipse cx="36" rx="7" ry="23" fill="#d2bd91" stroke="#9e895f" />
        <path d="M-24-10H24M-24-1H18M-24 8H22" stroke="#887c60" strokeWidth="2" />
      </g>
    )
  if (kind === 'wing')
    return (
      <g className="signature-breathe">
        <path
          d="M-46 5Q-35-22 0-19T48 5"
          fill="none"
          stroke="#9b9b75"
          strokeWidth="4"
          opacity=".65"
        />
        <path d="M-33 13Q0 3 31 13" stroke="#7f8b6c" strokeWidth="3" fill="none" />
      </g>
    )
  if (kind === 'beacon')
    return (
      <>
        <path
          d="M-17 205V33L-26 14H26L17 33V205Z"
          fill="#778d84"
          stroke="#a8b5a0"
          strokeWidth="3"
        />
        <path d="M-30 14V-20L0-40 30-20V14Z" fill="#4e6a65" stroke="#a7b9a7" strokeWidth="3" />
        <g className="signature-sweep">
          <path d="M0-3 100-20V13Z" fill="#c8d3ac" opacity=".16" />
          <path d="M0-3 100-20M0-3 100 13" stroke="#c1cdac" opacity=".5" />
        </g>
        <ellipse cy="-3" rx="12" ry="17" fill="#c5c8a2" />
        <path d="M-34 205H34" stroke="#8fa18d" strokeWidth="9" />
      </>
    )
  if (kind === 'balance')
    return (
      <>
        <path d="M-35 32H35M0 32V-34" stroke={brass} strokeWidth="5" />
        <g className="signature-needle">
          <path d="M-43-23H43M-35-23V7M35-23V7" stroke={brass} strokeWidth="3" />
          <path d="M-52 7Q-35 31-18 7ZM18 7Q35 31 52 7Z" fill="#8eaaa1" stroke={brass} />
        </g>
        <circle cy="-24" r="6" fill="#ddd0a5" />
      </>
    )
  if (kind === 'prism')
    return (
      <>
        <path d="M-32 30H32M-20 28 0-26 20 28" stroke={brass} strokeWidth="3" fill="none" />
        <g className="signature-spin">
          <path d="M0-23 17 3 0 25-17 3Z" fill="#a3c6c2" opacity=".8" stroke="#d1dfcd" />
          <path d="M0-23V25M-17 3H17" stroke="#e0e8ce" />
        </g>
      </>
    )
  if (kind === 'capsule')
    return (
      <>
        <path d="M-18-65V65M18-65V65" stroke="#b39d73" strokeWidth="6" />
        <path d="M-12-65V65M12-65V65" stroke="#688c87" strokeWidth="2" />
        <g className="signature-capsule">
          <rect
            x="-11"
            y="-20"
            width="22"
            height="40"
            rx="9"
            fill="#d3c4a1"
            stroke="#7f6f53"
            strokeWidth="3"
          />
          <path d="M-7-7 0-1 7-7M-7-7H7V8H-7Z" fill="#9d8570" />
        </g>
      </>
    )
  if (kind === 'roller' || kind === 'paddle')
    return (
      <>
        <path d="M-44 28H44V37H-44Z" fill="#71634b" stroke={brass} />
        <ellipse rx="39" ry="20" fill="#394d48" stroke={brass} strokeWidth="4" />
        <g className="signature-spin">
          <path d="M-32 0H32M0-16V16" stroke="#c0ab82" strokeWidth="5" />
          <circle r="6" fill="#d3ba8e" />
        </g>
        {kind === 'roller' && <path d="M-28 22H28L20 56H-20Z" fill="#c2b697" stroke="#9a8565" />}
      </>
    )
  if (kind === 'claw')
    return (
      <>
        <path d="M0 38V9L-19-17" stroke="#b1b7a2" strokeWidth="8" fill="none" />
        <circle cy="8" r="9" fill="#6d9190" stroke={brass} />
        <g className="signature-needle">
          <path
            d="M-19-17-35-34-43-21M-19-17-10-40 2-35"
            stroke="#b8c8ba"
            strokeWidth="5"
            fill="none"
          />
        </g>
        <path d="M-25 39H25" stroke={brass} strokeWidth="8" />
      </>
    )
  if (kind === 'roaster')
    return (
      <g className="signature-spin">
        <circle r="62" fill="#344d46" stroke="#a89e78" strokeWidth="4" />
        <path d="M-49 0H49M0-49V49M-35-35 35 35M-35 35 35-35" stroke="#8d9d7e" strokeWidth="6" />
        <circle r="12" fill="#bfac7a" />
      </g>
    )
  if (kind === 'grinder')
    return (
      <>
        <path d="M-23-4H23L18 31H-18Z" fill="#826345" stroke={brass} />
        <ellipse cy="-5" rx="25" ry="9" fill="#4e4c3d" />
        <g className="signature-needle">
          <path d="M0-5V-23H30" fill="none" stroke={brass} strokeWidth="4" />
          <ellipse cx="32" cy="-23" rx="8" ry="5" fill="#6e503c" />
        </g>
      </>
    )
  if (kind === 'retort')
    return (
      <>
        <path
          d="M-17-35V-7Q-36 25-17 30H17Q36 25 17-7V-35Z"
          fill="#698b81"
          opacity=".7"
          stroke="#bdd0b5"
          strokeWidth="2"
        />
        <path d="M17-29H42V5" fill="none" stroke="#c7c1a4" strokeWidth="5" />
        <g className="signature-current">
          <path d="M-20 12Q0 5 20 12V24H-20Z" fill="#a5ba80" />
        </g>
        <circle className="signature-fall" cx="42" cy="8" r="3" fill="#c6d9bc" />
      </>
    )
  if (kind === 'keys')
    return (
      <>
        {[-1, 39, 99].map((x, i) => (
          <g key={x} className="signature-keypress" style={{ animationDelay: `${-i * 3.1}s` }}>
            <path d={`M${x} 5h17v18h-17Z`} fill="#b9ac8d" />
            <path d={`M${x} 23h17`} stroke="#8d876c" strokeWidth="1" />
          </g>
        ))}
      </>
    )
  if (kind === 'feather')
    return (
      <>
        <path d="M-17 13H13V31H-17Z" fill="#435c58" stroke={brass} />
        <g className="signature-sway">
          <path d="M-2 17 16-38Q40-45 25-10L-2 17" fill="#c0b89c" />
          <path d="M-2 17 24-31" stroke="#807c64" />
        </g>
      </>
    )
  if (kind === 'snail')
    return (
      <g className="signature-travel">
        <path d="M-27 19Q0 4 25 18L35 18 31 26H-27Z" fill="#9caa86" />
        <circle cy="7" r="17" fill="#957a57" stroke="#bea57b" strokeWidth="2" />
        <path
          d="M-8 8q0-15 14-8t-7 12M25 17 28 7M30 18 35 8"
          fill="none"
          stroke="#cab18a"
          strokeWidth="2"
        />
      </g>
    )
  if (kind === 'mushroom')
    return (
      <g className="signature-sway">
        <path d="M-7 4H7L12 34H-12Z" fill="#c8b99a" />
        <path d="M-36 6Q-28-35 0-35T36 6Z" fill="#a1806a" stroke="#c9ae82" strokeWidth="2" />
        {[-16, 3, 20].map((x, i) => (
          <ellipse key={x} cx={x} cy={-10 - (i % 2) * 10} rx="5" ry="3" fill="#d2c5a2" />
        ))}
      </g>
    )
  if (kind === 'web')
    return (
      <>
        <path d="M0-75V-10" stroke="#c0c8b2" opacity=".6" />
        <g className="signature-stamp">
          <ellipse cy="-3" rx="5" ry="8" fill="#7e8072" />
          <path
            d="M-3-4-14-11M3-4 14-11M-4 0-15 3M4 0 15 3M-3 4-12 12M3 4 12 12"
            stroke="#aaa994"
            strokeWidth="2"
          />
        </g>
      </>
    )
  if (['vine', 'reed', 'palm', 'fern', 'kelp', 'bamboo'].includes(kind))
    return (
      <>
        <path d="M0 38V-24" stroke="#7c9470" strokeWidth="4" />
        <g className="signature-sway">
          {[-26, -10, 7, 23].map((y, i) => (
            <g key={y}>
              <path
                d={`M0 ${y}Q-32 ${y - 28}-35 ${y - 9}Q-16 ${y + 7}0 ${y}`}
                fill={i % 2 ? '#78957c' : '#9baa80'}
              />
              <path
                d={`M0 ${y - 8}Q32 ${y - 36}35 ${y - 17}Q16 ${y - 1}0 ${y - 8}`}
                fill="#6f9482"
              />
            </g>
          ))}
        </g>
      </>
    )
  if (['clock', 'pendulum', 'metronome'].includes(kind))
    return (
      <>
        <path d="M-25-42Q0-62 25-42V38H-25Z" fill="#514439" stroke={brass} strokeWidth="3" />
        <circle cy="-24" r="17" fill="#d4c7a2" />
        <path d="M0-24V-35M0-24 9-20" stroke={ink} strokeWidth="2" />
        <g className="signature-swing">
          <path d="M0-5V26" stroke={brass} strokeWidth="3" />
          <circle cy="26" r="8" fill={brass} />
        </g>
      </>
    )
  if (['gauge', 'compass', 'wheel'].includes(kind))
    return (
      <>
        <circle r="26" fill="#263d40" stroke={brass} strokeWidth="5" />
        <circle r="19" fill="#c8c3a3" />
        {[0, 45, 90, 135].map((a) => (
          <path
            key={a}
            transform={`rotate(${a})`}
            d="M0-17V-12M0 12V17"
            stroke={ink}
            strokeWidth="2"
          />
        ))}
        <g className="signature-needle">
          <path d="M-3 6 0-17 3 6Z" fill="#9c604e" />
          <circle r="3" fill={ink} />
        </g>
      </>
    )
  if (
    [
      'propeller',
      'fan',
      'vane',
      'reel',
      'record',
      'grinder',
      'orrery',
      'musicbox',
      'mobile',
    ].includes(kind)
  )
    return (
      <>
        <path d="M-30 31H30M-21 29 0 10 21 29" stroke={brass} strokeWidth="4" fill="none" />
        <g className="signature-spin">
          {kind === 'record' ? (
            <>
              <circle r="30" fill="#283139" stroke={brass} />
              <circle r="19" fill="none" stroke="#697077" />
              <circle r="8" fill="#9e725d" />
            </>
          ) : kind === 'orrery' ? (
            <>
              <ellipse rx="35" ry="15" fill="none" stroke={brass} />
              <ellipse rx="15" ry="35" fill="none" stroke="#859b9b" />
              <circle r="10" fill="#bf9864" />
              <circle cx="31" cy="7" r="7" fill="#9baead" />
            </>
          ) : (
            <>
              {[0, 90, 180, 270].map((a) => (
                <path
                  key={a}
                  transform={`rotate(${a})`}
                  d="M0 0Q-19-12-12-31Q11-37 7-7Z"
                  fill={kind === 'mobile' ? '#b8a891' : '#819a92'}
                  stroke={brass}
                />
              ))}
              <circle r="6" fill={brass} />
            </>
          )}
        </g>
      </>
    )
  if (['book', 'album', 'paper', 'calendar', 'scroll', 'envelope', 'film'].includes(kind))
    return (
      <>
        <path
          d="M-36-20Q-18-25 0-17Q18-25 36-20V21Q17 16 0 24Q-18 16-36 21Z"
          fill="#b5a991"
          stroke="#6c5947"
          strokeWidth="2"
        />
        <path d="M0-17V23" stroke="#726651" />
        <g className="signature-page">
          <path d="M0-17Q21-31 31-21V13Q12 6 0 24Z" fill="#dbceb0" />
          <path d="M6-12 24-18M6-4 23-10M6 4 22-2" stroke="#9d9076" />
        </g>
      </>
    )
  if (['boat', 'caravan', 'rover', 'train', 'landscape'].includes(kind))
    return (
      <g className="signature-travel">
        <path d="M-45 9H45L31 25H-26Z" fill="#816c50" stroke="#b7a27c" strokeWidth="2" />
        <path d="M-27 9V-17H23L35 9" fill="#425b59" stroke="#9da78b" strokeWidth="2" />
        <path d="M-17-10H0V3H-17ZM7-10H20V3H7Z" fill="#d1b77a" />
        {kind === 'boat' ? (
          <path d="M-38 0-65-16M-24 22Q0 28 25 22" stroke="#9bab9a" fill="none" />
        ) : (
          <>
            <circle cx="-22" cy="25" r="7" fill="#273d3e" />
            <circle cx="24" cy="25" r="7" fill="#273d3e" />
          </>
        )}
      </g>
    )
  if (['water', 'wave', 'cascade', 'beam', 'beacon'].includes(kind))
    return (
      <g
        className={kind === 'beacon' ? 'signature-sweep' : 'signature-current'}
        fill="none"
        stroke={kind === 'beam' ? '#d9c98a' : '#9db9ae'}
        strokeWidth="2"
        opacity=".65"
      >
        {[0, 12, 24].map((y, i) => (
          <path
            key={y}
            d={
              kind === 'cascade'
                ? `M${i * 12 - 12}-45q-12 35 0 80`
                : kind === 'beacon' || kind === 'beam'
                  ? `M0 0 100 ${-25 + y}`
                  : `M-55 ${y}q27-12 55 0t55 0`
            }
          />
        ))}
      </g>
    )
  if (
    [
      'chime',
      'ornament',
      'sign',
      'ribbon',
      'flag',
      'rope',
      'bridge',
      'shutter',
      'antenna',
    ].includes(kind)
  )
    return (
      <>
        <path d="M0-45V-13" stroke="#9a8a67" strokeWidth="2" />
        <g className="signature-swing">
          <path
            d={
              kind === 'sign'
                ? 'M-32-12H32V20H-32Z'
                : kind === 'flag'
                  ? 'M0-12 36-4 0 12Z'
                  : 'M-17 4Q-17-24 0-24T17 4Z'
            }
            fill="#8f8e6d"
            stroke={brass}
            strokeWidth="2"
          />
          <path d="M0 4V27L-7 34H7L0 27" fill="#c0b690" stroke={brass} />
          {kind === 'sign' && <path d="M-23-1H23M-17 9H17" stroke="#d5c299" strokeWidth="3" />}
        </g>
      </>
    )
  if (
    [
      'bird',
      'squirrel',
      'wing',
      'butterfly',
      'moth',
      'ray',
      'jelly',
      'satellite',
      'balloon',
      'snail',
      'sax',
    ].includes(kind)
  )
    return (
      <g className="signature-drift">
        {kind === 'jelly' ? (
          <>
            <path d="M-24 0Q-22-41 0-41T24 0Z" fill="#98aaa9" opacity=".65" />
            <g className="signature-sway">
              <path
                d="M-15 0q-12 20 0 40M0 0q14 23 0 45M15 0q-10 19 0 37"
                stroke="#aabfba"
                fill="none"
              />
            </g>
          </>
        ) : kind === 'balloon' ? (
          <>
            <ellipse cy="-20" rx="24" ry="31" fill="#aa9175" />
            <path d="M-14 2-8 20H8L14 2M-8 20V29H8V20" stroke={brass} fill="#715d46" />
          </>
        ) : (
          <>
            <ellipse rx="22" ry="12" fill="#9eab9a" />
            <g className="signature-wing">
              <path
                d="M-3 0Q-24-44-40-16L-12 8M3 0Q24-44 40-16L12 8"
                fill="#728d88"
                stroke="#a1afa0"
              />
            </g>
            <path d="M20-4 32 0 20 4" fill={brass} />
            <circle cx="14" cy="-3" r="2" fill="#263834" />
          </>
        )}
      </g>
    )
  if (['retort', 'brush', 'drop', 'beans', 'stamp', 'keys'].includes(kind))
    return (
      <>
        <path d="M-23 26H23V-16H-23Z" fill="#405d5b" stroke="#91a99b" strokeWidth="2" />
        <path d="M-19 13H19V23H-19Z" fill="#9caa80" />
        <g className={kind === 'stamp' ? 'signature-stamp' : 'signature-fall'}>
          <path
            d={kind === 'keys' ? 'M-20-22H20V-13H-20Z' : 'M0-39Q-12-23 0-20Q12-23 0-39Z'}
            fill={kind === 'beans' ? '#9b7758' : '#b9cabc'}
          />
        </g>
      </>
    )
  throw new Error(`Unimplemented premium motion subject: ${kind}`)
}
const WALL_MOUNTED = new Set(['clock', 'pendulum', 'gauge', 'wheel', 'rope', 'metronome'])
function Support({ item }: { item: PremiumMotion }) {
  if (
    item.kind === 'mobile' ||
    item.kind === 'star' ||
    (item.kind === 'orrery' && item.id.startsWith('moon-alchemy'))
  )
    return <path d={`M0 ${-item.y}V-35`} stroke="#9d9273" strokeWidth="2" />
  if (item.kind === 'capsule')
    return (
      <>
        <path
          d={`M-18-65V${-item.y + 80}H120M18-65V${-item.y + 110}H120`}
          fill="none"
          stroke="#a88e65"
          strokeWidth="5"
        />
        <path d="M-25 65H25V85H-25Z" fill="#71624c" stroke="#b6a07b" />
      </>
    )

  if (item.layer === 'foreground' && WALL_MOUNTED.has(item.kind))
    return (
      <g>
        <path d="M-34-54H34V48H-34Z" fill="#584c3e" stroke="#998568" strokeWidth="2" />
        <path d="M-28-48H28M-28 42H28" stroke="#b6a07b" opacity=".6" />
        <circle cx="-27" cy="-46" r="2" fill="#d5c09b" />
        <circle cx="27" cy="-46" r="2" fill="#d5c09b" />
      </g>
    )
  if (item.kind === 'bird' || item.kind === 'squirrel')
    return (
      <path
        d="M-90 28Q-30 20 10 25T105 10M-45 23-66 6"
        stroke="#746c50"
        strokeWidth="7"
        fill="none"
      />
    )
  if (item.kind === 'snail' || item.kind === 'mushroom' || item.kind === 'caravan')
    return <path d="M-90 36Q0 20 100 36L135 65H-130Z" fill="#5c725b" opacity=".8" />
  return null
}
function Motion({ item, index }: { item: PremiumMotion; index: number }) {
  const style = {
    '--signature-duration': `${8 + index * 5}s`,
    '--signature-delay': `${-index * 2.7}s`,
  } as CSSProperties
  return (
    <g
      transform={`translate(${item.x} ${item.y})`}
      style={style}
      data-premium-motion={item.id}
      data-motion-kind={item.kind}
    >
      <title>{item.label}</title>
      <Support item={item} />
      <Subject kind={item.kind} />
    </g>
  )
}
export default function PremiumSignatureDetails({
  spaceId,
  layer,
  coffeeCount = 0,
}: {
  spaceId: string
  layer: 'background' | 'foreground'
  coffeeCount?: number
}) {
  const clip = `signature-${useId().replace(/:/g, '')}`
  const items = getPremiumExperience(spaceId).filter((item) => item.layer === layer)
  return (
    <g
      className="premium-signatures"
      data-signature-layer={layer}
      data-collection-level={Math.min(5, Math.floor(Math.max(0, coffeeCount) / 5))}
    >
      {layer === 'background' && (
        <defs>
          <clipPath id={clip}>
            <path d={premiumGeometry(spaceId).opening} />
          </clipPath>
          <mask id={`${clip}-frames`}>
            <rect width="800" height="820" fill="white" />
            <path d={premiumGeometry(spaceId).frames} fill="none" stroke="black" strokeWidth="12" />
          </mask>
        </defs>
      )}
      <g
        clipPath={layer === 'background' ? `url(#${clip})` : undefined}
        mask={layer === 'background' ? `url(#${clip}-frames)` : undefined}
      >
        {items.map((item, index) => (
          <Motion key={item.id} item={item} index={index} />
        ))}
      </g>
    </g>
  )
}
