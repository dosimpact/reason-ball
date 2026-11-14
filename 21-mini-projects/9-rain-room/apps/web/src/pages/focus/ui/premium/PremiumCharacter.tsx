import { PREMIUM_CAST } from '../../model/premiumCast'
import { usePremiumInterior } from './PremiumInterior'
type Props = {
  castId: string
  x?: number
  y?: number
  pose?: 'reading' | 'writing' | 'laptop' | 'coffee'
  facing?: number
  color?: string
  hair?: string
  view?: 'front' | 'profile' | 'back'
  haircut?: string
  standing?: boolean
  variant?: 'passenger'
}
const colors: Record<string, string> = {
  burgundy: '#866165',
  moss: '#697b62',
  indigo: '#626a83',
  ochre: '#aa9062',
  navy: '#536878',
  teal: '#5d8b86',
  sand: '#a49a7d',
  violet: '#80748c',
}
export default function PremiumCharacter({
  castId,
  x = 300,
  y = 610,
  pose = 'reading',
  facing = 1,
  view = 'profile',
  standing = false,
  variant,
}: Props) {
  const base = usePremiumInterior()
  const cast = PREMIUM_CAST[castId]!
  const p = { ...base, occupation: cast.occupation, hair: cast.hair }
  const coat = cast.coat,
    old = cast.age >= 60,
    skin = cast.skin,
    hair = cast.hairColor
  const hw = cast.headWidth,
    hh = cast.headHeight
  const shoulders =
    cast.body === 'broad' ? 37 : cast.body === 'petite' ? 26 : cast.body === 'slender' ? 28 : 32
  const hips = cast.body === 'broad' ? 48 : cast.body === 'petite' ? 35 : 40
  const profile = view === 'profile'
  // All facial landmarks and hair share the same local head coordinates.
  // Identity changes jaw/cheek curvature; a profile keeps a rounded bridge and chin.
  const jaw =
    cast.face === 'square' ? 22 : cast.face === 'angular' ? 17 : cast.face === 'heart' ? 11 : 18
  const chin = cast.face === 'long' ? 35 : cast.face === 'round' ? 29 : 31
  const facePath = profile
    ? `M-24-17C-23-34-8-41 8-36C21-33 25-23 24-11Q23-4 28 2L31 7Q32 10 26 11L24 11Q25 17 22 20Q22 28 12 ${chin}Q-4 ${chin + 3}-${jaw} 20C-26 10-28-5-24-17Z`
    : `M-25-15C-25-31-15-39 0-39C16-39 26-28 26-13L24 9Q22 24 ${jaw === 11 ? 8 : 15} ${chin - 3}Q0 ${chin + 8}-${jaw} ${chin - 3}Q-26 19-25-15Z`
  const apron = [
    'botanist',
    'tea-host',
    'painter',
    'roaster',
    'horticulturist',
    'restorer',
  ].includes(p.occupation)
  const uniform = ['conductor', 'postmaster', 'engineer', 'navigator'].includes(p.occupation)
  const robe = [
    'archivist',
    'alchemist',
    'storyteller',
    'forager',
    'traveler',
    'innkeeper',
  ].includes(p.occupation)
  const back = view === 'back'
  const h = standing ? 190 : 135
  return (
    <g
      transform={`translate(${x} ${y}) scale(${facing} 1)`}
      data-premium-character={cast.id}
      data-character-signature={cast.signature}
      data-character-face={cast.face}
      data-character-body={cast.body}
      data-character-stance={cast.stance}
      data-premium-person={pose}
      data-person-view={view}
      data-premium-occupation={p.occupation}
    >
      {!standing && cast.stance !== 'kneeling' && (
        <g fill="#38463d" stroke="#89907b" strokeWidth="3">
          <path d="M-48 60V-70q0-20 17-20h62q17 0 17 20V60z" />
          <path d="M-42 65v86m84-86v86" />
        </g>
      )}
      <path
        d={
          cast.stance === 'kneeling'
            ? `M-23 22Q-44 47-39 63Q-22 76 10 76M24 22Q44 49 33 69Q17 79-8 80`
            : cast.stance === 'reclined'
              ? `M-28 22q-12 47 13 70l-15 ${h - 92}m50-${h - 22}q36 44 30 70l-4 ${h - 92}`
              : cast.stance === 'perched'
                ? `M-28 22l20 55-28 ${h - 78}m58-${h - 22}-20 62 26 ${h - 84}`
                : standing
                  ? `M-28 22Q-31 97-36 ${h - 3}M28 22Q33 98 40 ${h - 3}`
                  : `M-27 24Q-46 46-32 70L-34 ${h - 3}M25 24Q45 46 31 70L37 ${h - 3}`
        }
        fill="none"
        stroke="#38484a"
        strokeWidth={standing ? 24 : 27}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={cast.stance === 'kneeling' ? 'M-40 86h37m15 0h25' : `M-48 ${h}h32m35 0h30`}
        stroke="#303c39"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {cast.stance === 'kneeling' && <ellipse cy="98" rx="68" ry="15" fill="#777b5c" />}
      {back && (
        <g data-character-depth="far-gesture">
          <path
            d="M-29-62Q-52-66-48-48M29-62Q52-66 48-48"
            fill="none"
            stroke={coat}
            strokeWidth="19"
            strokeLinecap="round"
          />
          <g transform="translate(0 -51)" data-character-held-prop={pose}>
            {pose === 'laptop' ? (
              <path
                d="M-49 8-55-48H45L39 8zM-53 10H50"
                fill="#708a87"
                stroke="#b1b69b"
                strokeWidth="3"
              />
            ) : (
              <>
                <path d="M-48-5 0-20 47-4 42 15 0 4-43 15z" fill="#c7bb9d" />
                <path d="M0-19v23m-34-4 23-8m23 0 23 8" stroke="#8c896e" strokeWidth="2" />
              </>
            )}
            <ellipse cx="-46" cy="7" rx="6" ry="4" fill={skin} />
            <ellipse cx="44" cy="7" rx="6" ry="4" fill={skin} />
          </g>
        </g>
      )}
      <path
        data-character-depth="torso"
        d={
          robe
            ? `M-${shoulders}-77q${shoulders}-17 ${shoulders * 2} 0l24 ${h + 67}H-${hips + 5}z`
            : `M-${shoulders}-78q${shoulders}-${cast.stance === 'hunched' ? 24 : 16} ${shoulders * 2} 0Q${hips + (cast.stance === 'leaning' ? 9 : 0)} -10 ${hips} 29q-${hips} 17-${hips * 2} 0z`
        }
        fill={coat}
      />
      {back ? (
        <g
          data-character-garment="back"
          fill="none"
          stroke="#424a47"
          strokeWidth="1.5"
          opacity=".45"
        >
          <path d={`M-${shoulders - 5}-73Q0-60 ${shoulders - 5}-73M0-66V25`} />
        </g>
      ) : (
        <g data-character-garment="front">
          {uniform && (
            <>
              <path
                d="M-29-75-5-45 0-75 9-46 31-75M0-45v72"
                fill="none"
                stroke="#c3b58a"
                strokeWidth="3"
              />
              {[-20, 0, 20].map((a) => (
                <circle key={a} cx="8" cy={a} r="2" fill="#c8b782" />
              ))}
            </>
          )}
          {apron && (
            <>
              <path
                d="M-20-68h40l13 102h-66z"
                fill={p.occupation === 'painter' ? '#a8a48b' : '#b2a181'}
              />
              <path
                d="M-20-68-12-85m32 17-8-17M-23-8h45v26h-45z"
                fill="none"
                stroke="#665e4a"
                strokeWidth="3"
              />
              {p.occupation === 'painter' && (
                <path d="m-16-24 14 6m5 13 13-8m-24 23 11 4" stroke="#a67464" strokeWidth="6" />
              )}
            </>
          )}
          {['treetop-house', 'naturalist', 'engineer'].includes(p.occupation) && (
            <path d="M-24-75-15 29m40-104L15 29" stroke="#b4a789" strokeWidth="8" />
          )}
          {cast.garment === 'waistcoat' && (
            <path
              d="M-26-76-4-49 0-75 7-50 27-76 30 20 0 32-30 20zM0-48v76"
              fill="#554e41"
              stroke="#c4b38d"
              strokeWidth="2"
            />
          )}
          {cast.garment === 'striped' && (
            <path
              d="M-31-52h62m-65 17h68m-70 17h70m-72 18h74"
              stroke="#c6bda1"
              strokeWidth="5"
              opacity=".7"
            />
          )}
          {cast.garment === 'cardigan' && (
            <path
              d="M-18-77-7 31m25-108L7 31M-10-21h20m-19 18h18m-16 18h14"
              stroke="#beb497"
              strokeWidth="3"
            />
          )}
          {cast.garment === 'knit' && (
            <>
              <path d="M-17-88h34v20h-34z" fill={coat} />
              <path
                d="M-25-55l8 9 8-9 8 9 8-9 8 9 8-9m-49 25 8 9 8-9 8 9 8-9 8 9 8-9"
                fill="none"
                stroke="#b9b092"
                strokeWidth="3"
              />
            </>
          )}
          {cast.garment === 'cape' && (
            <path
              d="M-25-83-58-22-36 6 0-46 37 6 58-22 25-83 0-62z"
              fill="#9c8c6d"
              stroke="#d0bd92"
              strokeWidth="2"
            />
          )}
          {cast.garment === 'kimono' && (
            <path
              d="M-32-77 24 5-16 32 32-77m-60 78h56v20h-56"
              fill="none"
              stroke="#bab396"
              strokeWidth="9"
            />
          )}
          {cast.garment === 'utility' && (
            <>
              <path d="M-28-46h23v23h-23zm34 0h23v23H6z" fill="#a6b0a0" />
              <path d="M0-75v100m-34-6h68" stroke="#bbbaa0" strokeWidth="4" />
            </>
          )}
          {cast.garment === 'vest' && (
            <path
              d="M-31-77-20-16h40l11-61M-20-16l-6 45m46-45 6 45"
              stroke="#b4ac8e"
              strokeWidth="8"
              fill="none"
            />
          )}
          {cast.garment === 'scarf' && (
            <path d="M-23-88q23 20 46 0v18L0-55-18 4l-17-8 15-66z" fill="#b7aa85" />
          )}
        </g>
      )}
      <path d="M-9-105Q0-110 9-105L11-78Q0-70-11-78Z" fill={skin} />
      <g
        transform={`${profile ? 'translate(6 -126)' : 'translate(0 -126)'} rotate(${cast.headTilt} 0 0) scale(${hw / 27} ${hh / 34})`}
        data-character-head="proportional"
      >
        {['long', 'braid', 'bob'].includes(p.hair) && (
          <path
            d="M-28-12C-29-35-13-46 5-43C28-41 34-22 31 0L34 48Q20 53 13 46L-26 45Z"
            fill={hair}
          />
        )}
        {p.hair === 'ponytail' && (
          <path d="M-24-23C-51-36-51-9-43 9L-34 46Q-24 35-28 9L-19-14Z" fill={hair} />
        )}
        {p.hair === 'bun' && <circle cx="-24" cy="-32" r="14" fill={hair} />}
        {back ? (
          <path
            d="M-28-12C-29-32-17-43 0-43C19-43 30-30 29-11L27 18Q23 31 9 34L-10 33Q-27 27-28 11Z"
            fill={hair}
          />
        ) : (
          <>
            <path d={facePath} fill={skin} data-character-silhouette="curved" />
            <ellipse cx={profile ? -12 : -24} cy="2" rx="4.5" ry="7" fill={skin} />
            <path
              d={profile ? 'M-13-1q5-3 4 5' : 'M-24-1q4-2 3 5'}
              fill="none"
              stroke="#8d705d"
              strokeWidth="1.2"
              opacity=".55"
            />
          </>
        )}
        {!back && (
          <path
            d={
              p.hair === 'shaved'
                ? 'M-25-12C-24-33-11-41 3-40C18-39 27-30 27-16Q16-31 0-30Q-15-30-25-12Z'
                : p.hair === 'bob' || p.hair === 'long' || p.hair === 'braid'
                  ? 'M-27 17L-28-15C-28-34-16-43 2-43C19-43 30-32 30-18Q17-30 5-27L-13-21L-17 20Z'
                  : p.hair === 'curly' || p.hair === 'waves'
                    ? 'M-26-7Q-36-13-30-25Q-35-38-20-40Q-14-52-1-43Q10-51 20-40Q35-38 30-25Q39-13 27-7L20-24Q9-20 1-27Q-10-21-19-26Z'
                    : 'M-26-2C-35-24-22-43-2-43C17-45 31-31 29-15Q18-24 11-25Q0-20-9-27L-20-20Z'
            }
            fill={hair}
          />
        )}
        {p.hair === 'braid' && (
          <path
            d="M-23 20q-10 10-1 17-10 9-1 17-8 9 0 17"
            stroke={hair}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {!back && (
          <g
            data-face-expression={cast.expression}
            fill="none"
            stroke="#51483e"
            strokeLinecap="round"
            strokeWidth="1.7"
          >
            <path
              data-face-feature="brows"
              d={
                profile
                  ? cast.expression === 'thoughtful'
                    ? 'M8-12q6-4 12-1'
                    : 'M8-10q6-2 12 0'
                  : cast.expression === 'thoughtful'
                    ? 'M-18-12q5-5 11-2M7-11q7-2 13 0'
                    : 'M-18-10q5-2 11 0M7-10q7-2 13 0'
              }
            />
            <path
              data-face-feature="eyes"
              d={
                profile
                  ? cast.expression === 'sleepy'
                    ? 'M10-1q5 2 10 0'
                    : 'M10-2q5-3 10 0'
                  : cast.expression === 'sleepy'
                    ? 'M-18-1q5 2 10 0M8-1q5 2 10 0'
                    : 'M-18-2q5-3 10 0M8-2q5-3 10 0'
              }
            />
            {cast.expression !== 'sleepy' &&
              (profile ? (
                <ellipse
                  cx={cast.expression === 'thoughtful' ? 17 : 15}
                  cy={cast.expression === 'focused' ? 1 : 0}
                  rx="1.1"
                  ry="1.5"
                  fill="#51483e"
                />
              ) : (
                <>
                  <ellipse
                    cx={cast.expression === 'thoughtful' ? -11 : -13}
                    cy={cast.expression === 'focused' ? 1 : 0}
                    rx="1.1"
                    ry="1.5"
                    fill="#51483e"
                  />
                  <ellipse
                    cx={cast.expression === 'thoughtful' ? 15 : 13}
                    cy={cast.expression === 'focused' ? 1 : 0}
                    rx="1.1"
                    ry="1.5"
                    fill="#51483e"
                  />
                </>
              ))}
            {!profile && <path d="M1 1q-3 7-1 9h4" opacity=".5" strokeWidth="1.2" />}
            <path
              data-face-feature="mouth"
              d={
                profile
                  ? cast.expression === 'calm'
                    ? 'M13 19q5 4 10-1'
                    : cast.expression === 'thoughtful'
                      ? 'M14 20q4 1 8-1'
                      : cast.expression === 'sleepy'
                        ? 'M13 19q5 3 9 0'
                        : 'M13 19q5 2 9 0'
                  : cast.expression === 'calm'
                    ? 'M-7 19q8 7 16 0'
                    : cast.expression === 'thoughtful'
                      ? 'M-4 20q6 2 11-1'
                      : cast.expression === 'sleepy'
                        ? 'M-5 19q6 3 12 0'
                        : 'M-5 19q6 2 12 0'
              }
            />
            {old && <path d="M-23 6h3m36 0h3" opacity=".4" />}
          </g>
        )}
        {p.hair === 'beard' && !back && (
          <path d="M-23 11q8 39 39 20l9-17-12 10-17-6-10 5z" fill={hair} />
        )}
        {uniform && (
          <>
            <path d="M-33-30q33-31 66 0v9h-66z" fill={coat} />
            {!back && (
              <>
                <path d="M-32-21h72" stroke="#bca979" strokeWidth="6" />
                <circle cy="-32" r="4" fill="#c5b58c" />
              </>
            )}
          </>
        )}
        {p.hair === 'wrapped' && (
          <path
            d="M-32-9q-9-47 30-41 35-4 35 36l-20-12-32 11zM-28-23 28-36"
            fill="#b8a681"
            stroke="#8c805f"
            strokeWidth="4"
          />
        )}
      </g>
      {!back && p.occupation === 'elder' && (
        <path d="M-33-72-45-29 0-45 42-26 30-75 0-56z" fill="#ac9b86" />
      )}
      {p.occupation === 'designer' && (
        <path
          d="M-27-137q-6-35 31-34 34 3 27 35m-57-3v22m58-21v22"
          stroke="#97aba0"
          strokeWidth="8"
          fill="none"
        />
      )}
      {!back && (
        <g data-character-depth="near-gesture">
          <path
            d={
              pose === 'coffee'
                ? 'M-30-61Q-51-22-3-4M28-62Q53-44 38-77L30-91'
                : p.occupation === 'pianist'
                  ? 'M-30-61q-43 18-77 35M28-60q-42 31-109 34'
                  : p.occupation === 'alchemist'
                    ? 'M-30-61q-45-10-76-65M28-62q12 39-25 55'
                    : p.occupation === 'painter'
                      ? 'M-29-62q-20 21-17 63M29-62Q8-73-26-94Q-43-103-57-104'
                      : p.occupation === 'astronomer'
                        ? 'M-30-62Q-64-37-104-29M28-62Q4-18-82-27'
                        : `M-30-61Q${cast.elbowLeft} -17 -31 7M29-61Q${cast.elbowRight} -14 32 7`
            }
            stroke={skin}
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M-30-66-37-42m66-24 8 25" stroke={coat} strokeWidth="22" strokeLinecap="round" />
          {p.occupation === 'alchemist' ? (
            <>
              <path d="M-106-125v-40" stroke="#c5d0ae" strokeWidth="5" />
              <path d="M-106-165v-12" stroke="#717e71" strokeWidth="9" />
              <circle cx="-106" cy="-117" r="3" fill="#bfce9a" />
            </>
          ) : p.occupation === 'painter' ? (
            <>
              <path
                data-held-tool="brush"
                d="M-57-104-94-138"
                stroke="#aa8b5e"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse cx="-47" cy="7" rx="29" ry="13" fill="#b9a581" />
              <circle cx="-62" cy="5" r="4" fill="#a16d58" />
              <circle cx="-39" cy="1" r="4" fill="#638f84" />
            </>
          ) : p.occupation === 'astronomer' ? (
            <g data-held-tool="star-viewer">
              <rect
                x="-103"
                y="-37"
                width="28"
                height="19"
                rx="5"
                fill="#aebba2"
                stroke="#5b746f"
                strokeWidth="3"
              />
              <path d="M-96-18v12" stroke="#5b746f" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="-104" cy="-28" rx="4" ry="6" fill="#718b83" />
            </g>
          ) : p.occupation === 'pianist' ? null : pose === 'coffee' ? (
            <g transform="translate(13 -101)">
              <path d="M-13-7H13L11 10Q0 16-11 10Z" fill="#cfb98e" />
              <path d="M13-3Q27-6 24 4Q22 10 12 7" fill="none" stroke="#cfb98e" strokeWidth="4" />
              <ellipse cy="-7" rx="13" ry="3" fill="#e0cfa7" />
              <ellipse cy="-7" rx="10" ry="1.8" fill="#685642" />
            </g>
          ) : pose === 'laptop' ? (
            <path
              d="M-49 8-55-48H45L39 8zM-53 10H50"
              fill="#708a87"
              stroke="#b1b69b"
              strokeWidth="3"
            />
          ) : (
            <>
              <path
                d="M-48-5 0-20 47-4 42 15 0 4-43 15z"
                fill={p.occupation === 'postmaster' ? '#b7ad8a' : '#c7bb9d'}
              />
              <path d="M0-19v23m-34-4 23-8m23 0 23 8" stroke="#8c896e" strokeWidth="2" />
              {[
                'alchemist',
                'cartographer',
                'restorer',
                'composer',
                'engineer',
                'botanist',
              ].includes(p.occupation) && (
                <path
                  data-held-tool="pencil"
                  d="M31 6 39-22"
                  stroke="#574d3b"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
            </>
          )}
          {!back && (
            <g fill={skin} data-character-hands={pose}>
              {pose === 'coffee' ? (
                <>
                  <ellipse cx="30" cy="-91" rx="5" ry="6" transform="rotate(-20 30 -91)" />
                  <ellipse cx="-3" cy="-4" rx="7" ry="4" />
                </>
              ) : p.occupation === 'pianist' ? (
                <>
                  <ellipse cx="-105" cy="-26" rx="9" ry="4" />
                  <ellipse cx="-80" cy="-26" rx="9" ry="4" />
                </>
              ) : p.occupation === 'alchemist' ? (
                <ellipse cx="-106" cy="-125" rx="5" ry="6" />
              ) : p.occupation === 'painter' ? (
                <>
                  <ellipse cx="-57" cy="-104" rx="5" ry="6" />
                  <ellipse cx="-46" cy="1" rx="6" ry="4" />
                </>
              ) : p.occupation === 'astronomer' ? (
                <>
                  <ellipse cx="-104" cy="-29" rx="6" ry="4.5" />
                  <ellipse cx="-82" cy="-27" rx="6" ry="4.5" />
                </>
              ) : pose !== 'laptop' ? (
                <>
                  <ellipse cx="-31" cy="9" rx="8" ry="4.5" transform="rotate(-14 -31 9)" />
                  <ellipse cx="32" cy="8" rx="8" ry="4.5" transform="rotate(14 32 8)" />
                </>
              ) : null}
            </g>
          )}
        </g>
      )}
    </g>
  )
}
