import type { ReactNode } from 'react'
export function Cup({
  x = 400,
  y = 660,
  scale = 1,
  color = '#cbbd9a',
  steam = true,
}: {
  x?: number
  y?: number
  scale?: number
  color?: string
  steam?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} data-premium-object="cup">
      <ellipse cy="26" rx="44" ry="7" fill="#898d74" />
      <path d="M-26-7h52l-4 27q-21 13-44 0z" fill={color} />
      <path d="M25-2q28-8 23 12-3 12-24 7" stroke={color} strokeWidth="7" fill="none" />
      <ellipse cy="-7" rx="26" ry="5" fill="#4f4130" />
      {steam && (
        <path
          className="premium-steam"
          d="M-9-22q-8-14 0-29m16 31q9-18 0-36"
          stroke="#d7d2b2"
          strokeWidth="1.6"
          opacity=".32"
          fill="none"
        />
      )}
    </g>
  )
}
export function Book({ x = 300, y = 665, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-70-5 0-23 70-5l-6 30L0 10l-64 15z" fill="#c6b99a" />
      <path
        d="M0-21v32m-55-9L-12-8m-43 18 43-11M12-8l43 10M12 0l43 10"
        stroke="#93896f"
        strokeWidth="2"
      />
    </g>
  )
}
export function Table({
  x = 400,
  y = 660,
  width = 460,
  kind = 'wood',
}: {
  x?: number
  y?: number
  width?: number
  kind?: 'wood' | 'round' | 'low' | 'metal' | 'root'
}) {
  return (
    <g transform={`translate(${x} ${y})`} data-premium-object="table">
      {kind === 'round' ? (
        <>
          <ellipse rx={width / 2} ry="40" fill="#87704d" />
          <path d="M0 10v140m-70 10q70-24 140 0" stroke="#4e503b" strokeWidth="20" fill="none" />
        </>
      ) : (
        <>
          <path
            d={`M${-width / 2} 0q${width / 2}-18 ${width} 0v28H${-width / 2}z`}
            fill={kind === 'metal' ? '#7b8d81' : kind === 'root' ? '#89744f' : '#8a6e49'}
          />
          <path
            d={`M${-width / 2 + 25} 28v${kind === 'low' ? 75 : 165}m${width - 50} ${kind === 'low' ? -75 : -165}v${kind === 'low' ? 75 : 165}`}
            stroke={kind === 'metal' ? '#4f6660' : '#4f4431'}
            strokeWidth={kind === 'root' ? 25 : 17}
          />
          <path
            d={`M${-width / 2 + 20} 9h${width - 40}`}
            stroke="#b09a6c"
            strokeOpacity=".3"
            strokeWidth="2"
          />
        </>
      )}
    </g>
  )
}
export function Shelf({
  x = 40,
  y = 180,
  rows = 3,
  width = 170,
}: {
  x?: number
  y?: number
  rows?: number
  width?: number
}) {
  return (
    <g transform={`translate(${x} ${y})`} data-premium-object="bookshelf">
      <path d={`M0 0h${width}v${rows * 95 + 15}H0z`} fill="#3e3b2d" />
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={10 + (i * (width - 20)) / 7}
              y={15 + r * 95 + (i % 3) * 5}
              width={(width - 35) / 7}
              height={65 - (i % 3) * 5}
              rx="1"
              fill={['#827451', '#617267', '#785949', '#9a8762'][i % 4]}
            />
          ))}
          <path d={`M0 ${87 + r * 95}h${width}`} stroke="#9b8158" strokeWidth="7" />
        </g>
      ))}
    </g>
  )
}
export function Lamp({
  x,
  y,
  kind = 'pendant',
}: {
  x: number
  y: number
  kind?: 'pendant' | 'lantern' | 'floor' | 'orb'
}) {
  return (
    <g data-premium-object="lamp">
      {kind === 'floor' ? (
        <>
          <path d={`M${x} ${y}v210m-35 0h70`} stroke="#8f8e71" strokeWidth="8" />
          <path d={`M${x - 28} ${y - 35}h56l24 55h-104z`} fill="#b09b66" />
          <ellipse cx={x} cy={y + 20} rx="50" ry="6" fill="#ead39a" />
        </>
      ) : kind === 'lantern' ? (
        <>
          <path
            d={`M${x} 0v${y - 55}m-16 9q16-22 32 0`}
            stroke="#898767"
            strokeWidth="4"
            fill="none"
          />
          <rect x={x - 30} y={y - 42} width="60" height="78" rx="5" fill="#9d966f" />
          <rect x={x - 21} y={y - 34} width="42" height="60" fill="#c6b277" />
          <path d={`M${x} ${y - 34}v60m-38 11h76`} stroke="#766f50" strokeWidth="7" />
        </>
      ) : kind === 'orb' ? (
        <>
          <path d={`M${x} 0v${y - 30}`} stroke="#7b876d" strokeWidth="4" />
          <circle cx={x} cy={y} r="32" fill="#d6cf9e" />
          <path
            d={`M${x - 28} ${y - 8}q28 12 56 0m-56 18q28 12 56 0`}
            fill="none"
            stroke="#b1ad81"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path d={`M${x} 0v${y - 48}`} stroke="#6b6049" strokeWidth="4" />
          <path d={`M${x - 25} ${y - 48}h50l38 54h-126z`} fill="#9e8153" />
          <ellipse cx={x} cy={y + 6} rx="62" ry="8" fill="#e4ca8e" />
        </>
      )}
    </g>
  )
}
export function Plant({
  x = 710,
  y = 700,
  kind = 'leaf',
  scale = 1,
  mountY = 0,
}: {
  x?: number
  y?: number
  kind?: 'leaf' | 'fern' | 'flower' | 'bonsai' | 'hanging'
  scale?: number
  mountY?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} data-premium-object="plant">
      <path d="M-28-18h56l-8 62h-40z" fill="#8c7452" />
      {kind === 'hanging' && (
        <path
          d={`M-27-18-40 ${(mountY - y) / scale}M27-18 40 ${(mountY - y) / scale}M-40 ${(mountY - y) / scale}h80`}
          stroke="#a49974"
          strokeWidth="3"
          fill="none"
        />
      )}
      <path
        d="M0-18v-135m0 45q-42-45-57-15 27 31 57 15m0 8q43-50 62-20-32 30-62 20m0 45q-50-32-62-4 35 25 62 4m0-7q45-38 60-10-33 27-60 10"
        fill="none"
        stroke={kind === 'flower' ? '#647c57' : '#546e4e'}
        strokeWidth={kind === 'fern' ? 8 : 14}
        strokeLinecap="round"
      />
      {kind === 'flower' &&
        [-30, 0, 35].map((cx, i) => (
          <g key={cx} transform={`translate(${cx} ${-130 + (i % 2) * 30})`} fill="#b69a8d">
            <circle cx="-9" r="10" />
            <circle cx="9" r="10" />
            <circle cy="-9" r="10" />
            <circle cy="9" r="10" />
            <circle r="5" fill="#d0b684" />
          </g>
        ))}
    </g>
  )
}
export function Reader({
  x = 300,
  y = 610,
  pose = 'reading',
  facing = 1,
  color = '#7c7161',
  hair = '#4a3a2b',
  view = 'front',
  haircut = 'short',
}: {
  x?: number
  y?: number
  pose?: 'reading' | 'writing' | 'laptop' | 'coffee'
  facing?: number
  color?: string
  hair?: string
  view?: 'front' | 'profile' | 'back'
  haircut?: 'short' | 'bob' | 'bun' | 'curly' | 'ponytail'
}) {
  if (view === 'back')
    return (
      <g
        transform={`translate(${x} ${y}) scale(${facing} 1)`}
        data-premium-person={pose}
        data-person-view="back"
      >
        {pose === 'laptop' ? (
          <>
            <path d="M-58-80h116l7 64H-65z" fill="#315249" stroke="#9cafa0" strokeWidth="4" />
            <path d="M-49-71h98l6 46H-55z" fill="#5f8477" />
          </>
        ) : (
          <Book x={0} y={-45} scale={1.1} />
        )}
        <path
          d="M-27-66q-40 9-30 39m84-39q40 9 30 39"
          stroke="#b99070"
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M-10-102h20v35h-20z" fill="#b99070" />
        <path d="M-40-68q12-22 30-19h20q18-3 30 19l7 105h-94z" fill={color} />
        <path
          d="M0-78v103m-25-55q25 9 50 0"
          fill="none"
          stroke="#314638"
          strokeWidth="3"
          opacity=".35"
        />
        <ellipse cy="-125" rx="27" ry="32" fill={hair} />
        {haircut === 'bob' && <path d="M-27-135h54l7 48q-33 14-68 0z" fill={hair} />}{' '}
        {haircut === 'ponytail' && <path d="M20-140q35-12 30 15L32-79l-16-5 12-43z" fill={hair} />}{' '}
        {haircut === 'bun' && <circle cx="-15" cy="-154" r="17" fill={hair} />}
        <path
          d="M-18-146q-5 20 1 37m17-41q10 18 6 39"
          stroke="#b5aa8a"
          strokeWidth="2"
          fill="none"
          opacity=".22"
        />
        <path
          d="M-48 80V-6q0-16 17-16h62q17 0 17 16v86"
          fill="#4a5d49"
          stroke="#8b9272"
          strokeWidth="4"
        />
        <path d="M-35-5h70m-70 17h70m-70 17h70m-70 17h70" stroke="#6f7d5a" strokeWidth="6" />
        <path d="M-36 80l-8 65m80-65 8 65" stroke="#526246" strokeWidth="10" />
      </g>
    )
  return (
    <g
      transform={`translate(${x} ${y}) scale(${facing} 1)`}
      data-premium-person={pose}
      data-person-view={view}
    >
      <path
        d="M-47 72v-112q0-20 22-20h50q20 0 20 20V72"
        fill="#384439"
        stroke="#7a7b60"
        strokeWidth="4"
      />
      <path d="M-33 25h66l8 55-9 65H14L8 75H-6l-9 70h-18l-8-65z" fill="#41493c" />
      <path d="M-9-103h18v30H-9z" fill="#b99070" />
      <path
        d={
          view === 'profile'
            ? 'M-26-75q17-20 32-9l28 19 10 92q-35 14-71 0z'
            : 'M-37-76q12-20 29-9h16q19-11 29 9l8 103q-45 15-90 0z'
        }
        fill={color}
      />
      <g
        transform={`translate(${view === 'profile' ? 6 : pose === 'writing' ? 6 : 0} -124) rotate(${pose === 'coffee' ? -8 : 12})`}
      >
        {haircut === 'bob' && <path d="M-28-25q28-31 55 0l9 57q-35 13-70 0z" fill={hair} />}{' '}
        {haircut === 'bun' && <circle cx="-23" cy="-27" r="17" fill={hair} />}{' '}
        {haircut === 'ponytail' && <path d="M-22-25q-35-10-29 20l17 44 15-7-11-40z" fill={hair} />}
        {view === 'profile' ? (
          <path d="M-20-24q29-17 42 10l-1 16 11 10-11 4q-3 23-23 19-23-3-22-29z" fill="#c29b7a" />
        ) : (
          <ellipse rx="25" ry="30" fill="#c29b7a" />
        )}
        <path d="M-25 2q-12-37 13-40 32-7 39 26L12-21-14-15-22 5z" fill={hair} />
        {haircut === 'curly' &&
          [-24, -12, 0, 12, 24].map((cx, i) => (
            <circle key={cx} cx={cx} cy={-26 - (i % 2) * 8} r="11" fill={hair} />
          ))}
        {view === 'profile' ? (
          <path d="M11 8h6m-5 17h7" stroke="#655744" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <>
            <path d="M-10 9h5m13 0h5" stroke="#655744" strokeWidth="2" strokeLinecap="round" />
            <path d="M1 14v5m-4 8h8" fill="none" stroke="#927154" strokeWidth="1.5" />
          </>
        )}
      </g>
      {pose === 'coffee' ? (
        <>
          <path
            d="M-25-61q-20 45 3 59l34 4m14-64q28 10 22-16l-19-23"
            stroke="#b99070"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
          />
          <Cup x={13} y={-110} scale={0.55} />
        </>
      ) : (
        <>
          <path
            d="M-26-57q-20 36-5 47l30 10m28-57q24 34 10 48L15 1"
            stroke="#bd9777"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
          />
          {pose === 'laptop' ? (
            <>
              <path d="M5-48h80L73 6H-5z" fill="#33483f" stroke="#95a28d" strokeWidth="3" />
              <path d="M12-40h65L67-2H2z" fill="#5c796b" />
              <path d="M-15 9h110" stroke="#a4a78b" strokeWidth="6" />
            </>
          ) : (
            <>
              <Book x={0} y={7} scale={0.7} />
              {pose === 'writing' && <path d="m18 2 15-27" stroke="#334338" strokeWidth="4" />}
            </>
          )}
        </>
      )}
      <path d="M-26-72-34-48m60-24 10 22" stroke={color} strokeWidth="21" strokeLinecap="round" />
    </g>
  )
}
export function Pet({
  x = 650,
  y = 690,
  kind = 'cat',
  color = '#b7a181',
  scale = 1,
}: {
  x?: number
  y?: number
  kind?: 'cat' | 'fox' | 'owl' | 'dragon' | 'rabbit'
  color?: string
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} data-premium-animal={kind}>
      <ellipse cy="12" rx={kind === 'dragon' ? 105 : 65} ry="14" fill="#44563e" />
      {kind === 'owl' ? (
        <>
          <path d="M-25 8q-14-55 25-60Q38-49 25 8z" fill={color} />
          <circle cx="-10" cy="-31" r="14" fill="#d0bc91" />
          <circle cx="10" cy="-31" r="14" fill="#d0bc91" />
          <circle cx="-9" cy="-31" r="4" fill="#364436" />
          <circle cx="9" cy="-31" r="4" fill="#364436" />
          <path d="m-4-19 4 8 4-8" fill="#a38e61" />
          <path d="M-17 8v8m34-8v8" stroke="#b19a6e" strokeWidth="4" />
        </>
      ) : kind === 'rabbit' ? (
        <>
          <ellipse cx="-8" cy="-13" rx="29" ry="24" fill={color} />
          <circle cx="19" cy="-31" r="17" fill={color} />
          <path d="M10-43 3-80m22 36 8-39" stroke={color} strokeWidth="13" strokeLinecap="round" />
          <circle cx="26" cy="-34" r="2.5" fill="#364436" />
          <path d="M-20 8h15m20-1h20" stroke={color} strokeWidth="9" strokeLinecap="round" />
        </>
      ) : kind === 'dragon' ? (
        <>
          <path d="M-72 9q-65-30-27-48-5 28 34 16 30-25 72-7 24 11 32 29z" fill={color} />
          <path d="M-48-25-36-76 5-47-15-29" fill="#697d5e" stroke="#9da57a" strokeWidth="3" />
          <path d="M24-15q-4-38 25-33 21 0 29 23l20 9q-3 22-38 18L29 2z" fill={color} />
          <path d="m49-44 8-20 9 20m-41 13-12-14 3 25" fill="#b0a57c" />
          <path d="M60-19q7 5 14 0" stroke="#405142" strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <path d="M-47 7q-8-36 24-43 40-6 55 24L32 9z" fill={color} />
          <path
            d="M-35-7q-46-30-34 2 9 14 33 11"
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path d="M12-11 8-44l21 17 19-15 2 33q-4 26-23 21Q10 9 12-11" fill={color} />
          <path d="M20-5q4 4 8 0m8 0q4 4 8 0" stroke="#4c5140" strokeWidth="2" fill="none" />
          {kind === 'fox' && <path d="m27 5 37-13-13 18-24 3" fill="#d5c8a5" />}
          {kind === 'cat' && (
            <ellipse className="premium-yawn" cx="30" cy="4" rx="3" ry="4" fill="#6e5e47" />
          )}
          <path d="M4 10h19m13 0h18" stroke="#cfbfa0" strokeWidth="7" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}
export function Frame({
  x,
  y,
  width = 105,
  height = 80,
  children,
}: {
  x: number
  y: number
  width?: number
  height?: number
  children?: ReactNode
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} fill="#8e7b55" />
      <rect x="8" y="8" width={width - 16} height={height - 16} fill="#4b6155" />
      {children}
    </g>
  )
}
