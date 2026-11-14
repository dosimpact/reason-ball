import { useId } from 'react'
import { usePremiumInterior } from './PremiumInterior'
export function ThemeLamp({ x, y }: { x: number; y: number; kind?: string }) {
  const p = usePremiumInterior(),
    uid = useId().replace(/:/g, '')
  const k = p.lamp
  const side = ['sconce', 'banker', 'desk', 'gallery', 'spot'].includes(k),
    globe = ['paper', 'orb', 'globe', 'jelly', 'spore', 'seed', 'moon', 'star'].includes(k),
    cage = ['nautical', 'cage', 'lantern', 'pierced', 'andon', 'brazier', 'candelabra'].includes(k)
  return (
    <g data-premium-object="lamp" data-lamp-style={k}>
      <defs>
        <radialGradient id={uid}>
          <stop stopColor="#fff0bc" stopOpacity=".78" />
          <stop offset=".22" stopColor="#efd593" stopOpacity=".3" />
          <stop offset="1" stopColor="#eac584" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={x}
        cy={y + 12}
        rx={globe ? 94 : 120}
        ry={globe ? 110 : 95}
        fill={`url(#${uid})`}
      />
      {k === 'pumpkin' ? (
        <g>
          <path d={`M${x} 0v${y - 35}`} stroke="#7a8464" strokeWidth="3" />
          <ellipse cx={x} cy={y} rx="43" ry="33" fill="#b48e56" />
          <path
            d={`M${x - 12} ${y - 30}q-25 30 0 60m24-60q25 30 0 60`}
            stroke="#8f7548"
            strokeWidth="3"
            fill="none"
          />
          <path d={`M${x - 25} ${y}l12-13 9 13m12 0 12-13 9 13m-45 10q20 22 40 0`} fill="#e4ce86" />
        </g>
      ) : k === 'candle' ? (
        <g>
          <path
            d={`M${x} 0v${y - 35}m-42 70h84M${x} ${y - 35}v70m-38-40v30m76-30v30`}
            stroke="#b8a476"
            strokeWidth="6"
            fill="none"
          />
          {[-38, 0, 38].map((a) => (
            <g key={a}>
              <path d={`M${x + a - 6} ${y - 12}h12v38h-12z`} fill="#d9d0a7" />
              <path d={`M${x + a} ${y - 15}q-13-15 0-29 13 14 0 29`} fill="#f2d58e" />
            </g>
          ))}
        </g>
      ) : k === 'festoon' ? (
        <g>
          <path
            d={`M${x - 95} ${y - 40}q95 80 190 0`}
            fill="none"
            stroke="#849079"
            strokeWidth="3"
          />
          {[-75, -38, 0, 38, 75].map((a) => (
            <g key={a}>
              <path d={`M${x + a} ${y - Math.abs(a) / 3}v15`} stroke="#8c967e" strokeWidth="3" />
              <ellipse cx={x + a} cy={y + 17 - Math.abs(a) / 3} rx="9" ry="13" fill="#e3d1a1" />
            </g>
          ))}
        </g>
      ) : k === 'pleated' ? (
        <g>
          <path d={`M${x} ${y}v290m-38 0h76`} stroke="#aa9c77" strokeWidth="8" />
          <path d={`M${x - 30} ${y - 45}h60l28 77h-116z`} fill="#c5b48c" />
          {[-36, -18, 0, 18, 36].map((a) => (
            <path
              key={a}
              d={`M${x + a * 0.6} ${y - 43}l${a * 0.4} 73`}
              stroke="#968b6d"
              strokeWidth="2"
            />
          ))}
          <ellipse cx={x} cy={y + 32} rx="58" ry="7" fill="#ead8aa" />
        </g>
      ) : k === 'bell' ? (
        <g>
          <path d={`M${x} 0v${y - 40}`} stroke="#a18c64" strokeWidth="4" />
          <path
            d={`M${x - 10} ${y - 40}q-30 4-31 44l-13 14h108L${x + 40} ${y + 4}q-1-40-30-44z`}
            fill="#b7a16b"
            stroke="#d2bb83"
            strokeWidth="3"
          />
          <ellipse cx={x} cy={y + 18} rx="53" ry="8" fill="#ebd6a0" />
          <circle cx={x} cy={y + 20} r="9" fill="#9b875d" />
        </g>
      ) : side ? (
        <>
          <path d={`M${x - 45} ${y + 75}v-42l45-43`} stroke="#b7a57a" strokeWidth="7" fill="none" />
          <path d={`M${x - 60} ${y + 73}h35v11h-35z`} fill="#9e8e69" />
          <path
            d={`M${x - 32} ${y - 18}q32-28 64 0v25h-64z`}
            fill={k === 'banker' ? '#668a72' : '#a99b76'}
          />
          <ellipse cx={x} cy={y + 7} rx="31" ry="5" fill="#f5ddb0" />
        </>
      ) : globe ? (
        <>
          <path d={`M${x} 0v${y - 35}`} stroke="#8f876e" strokeWidth="3" />
          <ellipse
            cx={x}
            cy={y}
            rx={k === 'jelly' ? 44 : 33}
            ry={k === 'paper' ? 43 : 31}
            fill="#d7cfa5"
          />
          <path
            d={`M${x - 30} ${y - 10}q30 12 60 0m-60 21q30 12 60 0`}
            stroke="#a49f7c"
            fill="none"
          />
          {k === 'jelly' && (
            <path
              d={`M${x - 25} ${y + 22}q-12 25 2 42m20-40q13 25-2 48m21-50q-8 21 5 42`}
              stroke="#c7caab"
              strokeWidth="2"
              fill="none"
            />
          )}
        </>
      ) : cage ? (
        <>
          <path d={`M${x} 0v${y - 43}`} stroke="#8c8b6a" strokeWidth="4" />
          <path
            d={`M${x - 25} ${y - 35}h50v72h-50z`}
            fill="#c0b17f"
            stroke="#7f8060"
            strokeWidth="5"
          />
          <path d={`M${x - 14} ${y - 25}h28v50h-28z`} fill="#f0d99c" />
          <path
            d={`M${x - 34} ${y - 35}l34-21 34 21m-34 0v72m-34 4h68`}
            fill="none"
            stroke="#858263"
            strokeWidth="5"
          />
        </>
      ) : k === 'tube' || k === 'strip' ? (
        <>
          <path d={`M${x - 55} ${y}h110`} stroke="#d4dfc7" strokeWidth="11" strokeLinecap="round" />
          <path d={`M${x - 40} 0v${y - 8}m80-${y - 8}v${y - 8}`} stroke="#697c77" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d={`M${x} 0v${y - 34}`} stroke="#8e7e5f" strokeWidth="4" />
          <path
            d={`M${x - 18} ${y - 34}h36l38 40h-112z`}
            fill={k === 'copper' ? '#b78a63' : '#a79872'}
          />
          <ellipse cx={x} cy={y + 6} rx="54" ry="6" fill="#ecd9a8" />
        </>
      )}
      <circle cx={x} cy={y + 3} r="5" fill="#fff1c8" opacity=".88" />
    </g>
  )
}
export function ThemeTable({
  x = 400,
  y = 660,
  width = 460,
  kind = 'wood',
}: {
  x?: number
  y?: number
  width?: number
  kind?: string
}) {
  const p = usePremiumInterior()
  const w = width / 2,
    low = kind === 'low',
    round =
      kind === 'round' || ['orbital', 'petal', 'mushroom', 'porthole', 'brass'].includes(p.table),
    metal = ['console', 'wing', 'cantilever', 'porthole'].includes(p.table),
    height = low ? 75 : 155
  return (
    <g transform={`translate(${x} ${y})`} data-premium-object="table" data-table-style={p.table}>
      {round ? (
        <>
          <ellipse
            rx={w}
            ry="37"
            fill={metal ? '#8aa5a0' : p.table === 'brass' ? '#b5a06f' : '#8a8161'}
          />
          <path d={`M${-w} 0q${w} 65 ${width} 0v15q${-w} 60 ${-width} 0z`} fill="#655e48" />
          <path
            d={`M-18 28v${height - 20}h36V28m-70 ${height}q70-20 140 0`}
            fill="#4e594c"
            stroke="#879079"
            strokeWidth="5"
          />
        </>
      ) : (
        <>
          <path
            d={
              p.table === 'root' || p.table === 'claw'
                ? `M${-w} 0q30-15 65-6t90 0t90-4t${width - 245} 10l-8 27q-80 12-160 0t-${width - 168} 0z`
                : p.table === 'stone'
                  ? `M${-w} 0l25-12h${width - 50}l25 12-12 30H${-w + 12}z`
                  : `M${-w} 0q${w}-18 ${width} 0v27H${-w}z`
            }
            fill={
              metal
                ? '#91a59b'
                : p.table === 'lacquer'
                  ? '#735249'
                  : p.table === 'stone'
                    ? '#929784'
                    : '#927b57'
            }
          />
          {['trestle', 'folding', 'easel'].includes(p.table) ? (
            <path
              d={`M${-w + 25} 27l${width - 50} ${height}m0-${height}L${-w + 25} ${height + 27}M${-w + 10} ${height + 27}h${width - 20}`}
              stroke="#635d46"
              strokeWidth="13"
              fill="none"
            />
          ) : p.table === 'root' || p.table === 'claw' ? (
            <path
              d={`M${-w + 45} 24q35 70-20 ${height}m${width - 80}-${height}q-30 70 20 ${height}`}
              stroke="#625d42"
              strokeWidth="29"
              fill="none"
            />
          ) : p.table === 'drawer' ||
            p.table === 'heirloom' ||
            p.table === 'pigeonhole' ||
            p.table === 'counter' ? (
            <>
              <path d={`M${-w + 20} 27h${width - 40}v${height}H${-w + 20}z`} fill="#635c45" />
              <path
                d={`M${-w + 35} 49h${width - 70}v50H${-w + 35}zM0 28v${height}`}
                fill="none"
                stroke="#998568"
                strokeWidth="3"
              />
              <path d="M-30 69h60" stroke="#c1aa7b" strokeWidth="5" />
            </>
          ) : (
            <path
              d={`M${-w + 24} 27v${height}m${width - 48}-${height}v${height}M${-w + 24} ${height - 20}h${width - 48}`}
              stroke={metal ? '#567773' : '#605640'}
              strokeWidth={p.table === 'carved' ? 23 : 16}
              fill="none"
            />
          )}
          <path d={`M${-w + 20} 9h${width - 40}`} stroke="#c1b18b" opacity=".35" strokeWidth="2" />
          {p.table === 'marquetry' && (
            <path
              d={`M${-w + 30} 4l${w - 30} 12L${w - 30} 4M${-w + 30} 19h${width - 60}`}
              stroke="#cebc8c"
              opacity=".6"
              fill="none"
            />
          )}
        </>
      )}
    </g>
  )
}
