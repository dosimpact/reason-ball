import { useId } from 'react'
import { getSceneInterior, type LightFixture } from '../model/sceneInterior'
import { BACKGROUNDS } from '../model/backgrounds'
function Fixture({ light, contact }: { light: LightFixture; contact: number }) {
  const { kind, x, y } = light
  const base = (light.reach ?? x) - x
  const bottom = contact - y
  const cord = !['desk', 'sconce', 'floor', 'strip', 'track', 'string'].includes(kind)
  return (
    <g data-light-kind={kind} data-light-x={x} data-light-y={y} transform={`translate(${x} ${y})`}>
      {cord && (
        <path
          d={`M0 ${(light.mountY ?? 0) - y}V-35`}
          stroke={kind === 'rope' ? '#93856b' : '#4b4a3c'}
          strokeWidth={kind === 'rope' ? 5 : 3}
        />
      )}
      {kind === 'brass' || kind === 'rope' ? (
        <>
          <path d="M-29-41h58L60 0H-60Z" fill="#9b7950" />
          <ellipse rx="59" ry="7" fill="#f6d79d" />
        </>
      ) : kind === 'opal' ? (
        <>
          <circle r="32" fill="#d2ceaa" />
          <ellipse cy="-28" rx="11" ry="4" fill="#6f725c" />
          <circle cx="-8" cy="-5" r="16" fill="#fff0bf" opacity=".18" />
        </>
      ) : kind === 'rattan' ? (
        <>
          <path d="M-35-42h70L73 0H-73Z" fill="#9d8053" />
          {[-50, -25, 0, 25, 50].map((offset) => (
            <path
              key={offset}
              d={`M${offset * 0.45}-40 ${offset} 0M-62-12H62M-51-26H51`}
              stroke="#d4b47a"
              strokeWidth="2"
              opacity=".5"
            />
          ))}
          <ellipse rx="68" ry="5" fill="#e8c78c" />
        </>
      ) : kind === 'track' ? (
        <>
          <path d="M-36-34H36" stroke="#65706b" strokeWidth="6" />
          <path d="M0-34v12" stroke="#909687" strokeWidth="5" />
          <path d="M-17-22h34L23 0H-23Z" fill="#54635d" />
          <ellipse rx="22" ry="5" fill="#f3cf8b" />
        </>
      ) : kind === 'desk' ? (
        <>
          <path d={`M${base} ${bottom}V40L0-20`} fill="none" stroke="#a89772" strokeWidth="6" />
          <path
            d={`M${base - 22} ${bottom}h44`}
            stroke="#6b725f"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="M-25-30h40L43 0H-37Z" fill="#9b926b" />
          <path d="M-35 0h75" stroke="#f0d49b" strokeWidth="4" />
        </>
      ) : kind === 'sconce' ? (
        <>
          <path d="M-8-34h16v68H-8Z" fill="#6f7059" />
          <path d="M-23-23Q0-37 23-23L16 18Q0 32-16 18Z" fill="#d5be85" />
          <path d="M-15 29h30" stroke="#958568" strokeWidth="5" />
        </>
      ) : kind === 'library' ? (
        <>
          <path d={`M-135 ${-y}v-24M135 ${-y}v-24`} stroke="#746649" strokeWidth="3" />
          <path d="M-153-27Q0-50 153-27L166 0H-166Z" fill="#577063" />
          <path d="M-158 0h316" stroke="#eacb85" strokeWidth="6" />
        </>
      ) : kind === 'lantern' || kind === 'cage' || kind === 'floor' ? (
        <>
          <path d="M-25-28h50L31 27H-31Z" fill="#d1ad6e" opacity=".65" />
          <ellipse cx="-2" cy="0" rx="13" ry="23" fill="#ffe8b7" opacity=".65" />
          <path d="M-8 13q-9-14 1-25 0 12 7 14 6 9-8 11" fill="#fff0c4" />
          <path
            d="M-25-31h50l8 8H-33ZM-34 27h68v9h-68Z"
            fill={kind === 'cage' ? '#67766a' : '#72654d'}
          />
          <path
            d="M-23-28v56M23-28v56M0-28v56"
            stroke="#7c775c"
            strokeWidth={kind === 'cage' ? 4 : 2}
          />
          <path d="M-13-40Q0-56 13-40" fill="none" stroke="#81795c" strokeWidth="4" />
          {kind === 'floor' && (
            <>
              <path d="M-27 35v13m54-13v13" stroke="#6c7056" strokeWidth="6" />
              <ellipse cy="49" rx="42" ry="7" fill="#17261e" opacity=".4" />
            </>
          )}
        </>
      ) : kind === 'paper' ? (
        <>
          <path d="M0-42q-42 1-43 35-1 34 43 38Q44 27 43-7 42-41 0-42Z" fill="#d0c8a0" />
          <path
            d="M-36-21q36 9 72 0M-42-4q42 8 84 0M-36 16q36 7 72 0"
            fill="none"
            stroke="#e8dfb4"
            strokeWidth="2"
            opacity=".5"
          />
        </>
      ) : kind === 'string' ? (
        <>
          <path d="M-4-10h8v10h-8Z" fill="#9d9474" />
          <circle cy="5" r="8" fill="#f1d291" />
        </>
      ) : (
        <>
          <path d="M-145-8h290v16h-290Z" fill="#6b786f" />
          <path d="M-132 3h264" stroke="#e5d39b" strokeWidth="5" />
        </>
      )}
    </g>
  )
}
export default function RoomLighting({ scene }: { scene: number }) {
  const id = useId().replace(/:/g, '')
  const interior = getSceneInterior(scene)
  const contact = BACKGROUNDS.find((room) => room.scene === scene)!.companions ? 608 : 660
  return (
    <g data-room-lighting={scene}>
      <defs>
        {interior.lights.map((light, index) => (
          <radialGradient id={`${id}-${index}`} key={index}>
            <stop stopColor="#ffe3ab" stopOpacity={light.glow * 1.7} />
            <stop offset=".4" stopColor="#f2be73" stopOpacity={light.glow * 0.55} />
            <stop offset="1" stopColor="#f2be73" stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {interior.lights.some((light) => light.kind === 'string') && (
        <path d="M80 150Q400 230 720 150" fill="none" stroke="#746a4f" strokeWidth="2" />
      )}
      {interior.lights.map((light, index) => (
        <g key={index}>
          <ellipse
            cx={light.x}
            cy={light.y + 13}
            rx={
              light.kind === 'string'
                ? 62
                : light.kind === 'library' || light.kind === 'strip'
                  ? 195
                  : 120
            }
            ry={light.kind === 'string' ? 72 : 125}
            fill={`url(#${id}-${index})`}
          />
          <Fixture light={light} contact={contact} />
        </g>
      ))}
    </g>
  )
}
export function LightingOcclusions({ scene }: { scene: number }) {
  const interior = getSceneInterior(scene)
  const contact = BACKGROUNDS.find((room) => room.scene === scene)!.companions ? 608 : 660
  return (
    <g fill="black">
      {interior.lights.some((light) => light.kind === 'string') && (
        <path d="M80 150Q400 230 720 150" fill="none" stroke="black" strokeWidth="5" />
      )}
      {interior.lights
        .filter(
          (light) => !['desk', 'sconce', 'floor', 'strip', 'track', 'string'].includes(light.kind),
        )
        .map((light, index) => (
          <path
            key={`cord-${index}`}
            d={`M${light.x} ${light.mountY ?? 0}V${light.y - 35}`}
            stroke="black"
            strokeWidth="6"
          />
        ))}
      {interior.lights.map((light, index) => {
        const { kind, x, y } = light
        return kind === 'desk' ? (
          <g key={index}>
            <path
              d={`M${light.reach ?? x} ${contact}V${y + 40}L${x} ${y - 20}`}
              stroke="black"
              strokeWidth="10"
              fill="none"
            />
            <path d={`M${x - 30} ${y - 34}h50l30 40h-92Z`} />
          </g>
        ) : kind === 'sconce' ? (
          <rect key={index} x={x - 27} y={y - 38} width="54" height="76" rx="12" />
        ) : kind === 'strip' || kind === 'library' ? (
          <rect key={index} x={x - 170} y={y - 50} width="340" height="60" rx="8" />
        ) : kind === 'string' ? (
          <circle key={index} cx={x} cy={y + 3} r="12" />
        ) : (
          <rect
            key={index}
            x={x - (kind === 'rattan' ? 78 : kind === 'brass' || kind === 'rope' ? 65 : 40)}
            y={y - (kind === 'brass' ? 78 : 52)}
            width={kind === 'rattan' ? 156 : kind === 'brass' || kind === 'rope' ? 130 : 80}
            height={kind === 'brass' ? 110 : 104}
            rx="20"
          />
        )
      })}
    </g>
  )
}
