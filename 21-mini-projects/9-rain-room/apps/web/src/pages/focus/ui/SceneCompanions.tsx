import SceneTable from './SceneTable'
import type { Background } from '../model/backgrounds'

import {
  getSceneSeats,
  getSeatGeometry,
  type Seat,
  type Pose,
  type Hair,
  type CharacterAppearance,
  getCharacterAppearance,
} from '../model/sceneCast'

function HairExtra({ hair, color }: { hair: Hair; color: string }) {
  return (
    <g data-hair-shape={hair} fill={color}>
      {hair === 'long' && <path d="M-28-23q-13 42-7 78l17-4 3-45h34l3 45 15 4q7-52-12-81z" />}
      {hair === 'ponytail' && <path d="M-18-22q-29-11-24 17l11 47 12-7-6-46z" />}
      {hair === 'braid' && (
        <g>
          {[-16, -4, 8, 20, 32, 44].map((y, i) => (
            <ellipse key={y} cx={-28 + (i % 2) * 4} cy={y} rx="9" ry="10" />
          ))}
          <path d="m-27 51-6 13h16l-6-13" />
        </g>
      )}
      {hair === 'curly' && (
        <g>
          {[-24, -12, 0, 12, 24].map((x, i) => (
            <circle key={x} cx={x} cy={-24 - (i % 2) * 7} r="12" />
          ))}
          <circle cx="-29" cy="-9" r="10" />
          <circle cx="27" cy="-9" r="10" />
        </g>
      )}
      {hair === 'shaved' && <path d="M-24-5q-2-30 24-30 24 0 25 29L14-21Q0-30-15-18z" />}
    </g>
  )
}
function HeadDetails({
  appearance,
  back = false,
  profile = false,
}: {
  appearance?: CharacterAppearance
  back?: boolean
  profile?: boolean
}) {
  if (!appearance) return null
  return (
    <g data-character-detail={back ? 'back-accessory' : 'face-accessory'}>
      {appearance.accessory === 'headphones' && (
        <g fill="none" stroke="#b1aa91" strokeWidth="5">
          <path d="M-28 7v-24q0-25 28-25t28 25V7" />
          <path d="M-28 0v18m56-18v18" stroke="#55594e" strokeWidth="10" />
        </g>
      )}
      {!back && appearance.accessory === 'earring' && (
        <circle
          cx={profile ? -13 : -23}
          cy="19"
          r="4"
          fill="none"
          stroke="#c0a77c"
          strokeWidth="2"
        />
      )}
      {!back && appearance.age === 'mature' && (
        <g fill="none" stroke="#846b54" strokeWidth="1" opacity=".35">
          <path d="M-14 17h6m17 0h5M-7-9h15m-13-4H5" />
        </g>
      )}
    </g>
  )
}
function Clothing({
  appearance,
  back = false,
}: {
  appearance: CharacterAppearance
  back?: boolean
}) {
  const accent = '#b8ad91'
  return (
    <g data-garment={appearance.outfit}>
      {appearance.outfit === 'cardigan' && (
        <>
          <path d="M-15-64-8 30H8L15-64 0-43z" fill={accent} opacity=".6" />
          <path d="M0-40v69" stroke="#403e32" strokeWidth="3" />
          {!back && [-22, -6, 10, 24].map((y) => <circle key={y} cy={y} r="2" fill={accent} />)}
        </>
      )}
      {appearance.outfit === 'shirt' && (
        <>
          <path d="m-15-66 15 11-12 13-10-17m37-7L0-55 12-42l10-17" fill={accent} opacity=".7" />
          {!back && (
            <>
              <path d="M0-54v81m15-51h14v14H15z" stroke={accent} strokeWidth="1.5" fill="none" />
            </>
          )}
        </>
      )}
      {appearance.outfit === 'scarf' && (
        <>
          <path d="M-20-69q20 15 40 0l4 16q-24 15-48-1zM7-48l19 3-7 65H3z" fill={accent} />
          <path d="M11-40 8 13m4-65 9 2" stroke="#7f765d" strokeWidth="2" />
        </>
      )}
      {appearance.outfit === 'hoodie' && (
        <>
          <path
            d="M-30-56q-8-28 30-31 38 3 30 31L16-46 0-62-16-46z"
            fill={appearance.shirt}
            stroke="#9a9a82"
            strokeOpacity=".4"
            strokeWidth="3"
          />
          {!back && (
            <>
              <path
                d="M-11-51v29m22-29v29M-22 9q22-12 44 0l-5 17h-34z"
                fill="none"
                stroke={accent}
                strokeWidth="2"
                opacity=".6"
              />
            </>
          )}
        </>
      )}
      {appearance.outfit === 'vest' && (
        <>
          <path d="M-37-45-21-63l8 24L0-28 13-39l8-24 16 18v75H-37z" fill="#2c3e37" opacity=".52" />
          <path d="M0-28v57m-20-10h10m20 0h10" stroke={accent} strokeWidth="2" />
        </>
      )}
      {appearance.outfit === 'striped' && (
        <g stroke={accent} strokeWidth="4" opacity=".4">
          {[-36, -20, -4, 12, 28].map((y) => (
            <path key={y} d={`M-32 ${y}h64`} />
          ))}
        </g>
      )}
      {appearance.outfit === 'apron' && (
        <>
          <path d="M-21-63-26 30h52l-5-93-9 8 5 20h-34l5-20z" fill="#b2a083" opacity=".8" />
          <path d="M-14 0h28v19h-28z" fill="none" stroke="#685f4b" strokeWidth="2" />
          {back && <path d="m-24-34 48 36m-48 0 48-36" stroke="#625947" strokeWidth="4" />}
        </>
      )}
      {appearance.outfit === 'turtleneck' && (
        <path
          d="M-13-80h26l5 24q-18 12-36 0z"
          fill={appearance.shirt}
          stroke="#b1a78c"
          strokeOpacity=".25"
          strokeWidth="2"
        />
      )}
    </g>
  )
}

function Head({
  view,
  gaze,
  expression,
  hair,
  skin,
  hairColor,
  appearance,
}: Pick<Seat, 'view' | 'gaze' | 'expression' | 'hair'> & {
  skin: string
  hairColor: string
  appearance?: CharacterAppearance
}) {
  if (view === 'back')
    return (
      <g data-head-view="back">
        <HairExtra hair={hair} color={hairColor} />
        <ellipse cx="-23" cy="9" rx="4" ry="8" fill={skin} />
        <ellipse cx="23" cy="9" rx="4" ry="8" fill={skin} />
        {hair === 'bun' && <circle cx="0" cy="-29" r="16" fill={hairColor} />}
        <path
          d={
            hair === 'bob'
              ? 'M-25-19Q0-40 25-19l7 53q-32 13-63 0z'
              : 'M-24-18Q0-42 25-17l1 25q-3 25-26 25-24 0-26-25z'
          }
          fill={hairColor}
        />
        <path
          d={
            hair === 'shaved'
              ? 'M-23-8q0-28 23-28 24 0 25 28l-6-10q-20-17-36 0z'
              : hair === 'wavy'
                ? 'M-18-17q13 12 4 36m22-41q-13 16 1 35'
                : 'M-13-22q-8 19-3 34M9-25q10 17 7 34'
          }
          stroke="#d6c3a5"
          strokeOpacity=".12"
          strokeWidth="2"
          fill="none"
        />
        <HeadDetails appearance={appearance} back />
      </g>
    )
  const profile = view === 'profile'
  const front = view === 'front'
  const eyeY = gaze === 'down' ? 8 : 3
  const sleepy = expression === 'sleepy'
  const thinking = expression === 'thoughtful'
  const intentReading = gaze === 'down' && expression === 'focused'
  return (
    <g data-head-view={view} data-face-expression={expression}>
      <HairExtra hair={hair} color={hairColor} />
      {hair === 'bob' && (
        <path d="M-27-20Q0-44 27-19l7 55q-15 9-30 4-17 6-35-4z" fill={hairColor} />
      )}
      {hair === 'bun' && <circle cx={profile ? -23 : -19} cy="-23" r="14" fill={hairColor} />}
      <path
        d={
          front
            ? 'M-23-13Q-21-30 0-30q22 0 23 20v17Q21 31 0 33-22 30-23 7z'
            : profile
              ? 'M-16-24q26-9 32 12l1 13q1 3 4 5 2 2 0 4l-4 2q-2 18-18 18-20-2-20-27z'
              : 'M-23-13Q-20-31 3-30q20 1 22 23l-1 14q0 3 3 4 2 2 0 3l-6 2Q13 34-4 31-25 26-25 4z'
        }
        fill={skin}
      />
      <path
        d={
          hair === 'wavy'
            ? 'M-24 0q-10-16 0-28-1-13 14-13 9-9 19-2 17-2 21 13 9 11 0 24L16-19Q5-8-5-17L-21-5z'
            : hair === 'bob'
              ? 'M-26 8v-28Q0-44 27-19l2 19-11-18Q3-9-12-18L-20 9z'
              : hair === 'bun'
                ? 'M-24 3q-10-31 12-36 26-10 38 12L24-2 11-22-16-13z'
                : 'M-23 1q-10-29 10-36 28-7 40 15L24-2 12-19-8-17-21-7z'
        }
        fill={hairColor}
      />
      {profile && <ellipse cx="-12" cy="10" rx="5" ry="8" fill={skin} />}
      <g
        data-face-feature="eyes"
        fill="none"
        stroke="#4c493b"
        strokeWidth="2"
        strokeLinecap="round"
      >
        {front ? (
          <>
            <path data-eye="left" d={`M-13 ${eyeY}q4 ${sleepy ? 1 : -2} 7 0`} />
            <path data-eye="right" d={`M6 ${eyeY}q4 ${sleepy ? 1 : -2} 7 0`} />
          </>
        ) : profile ? (
          <path data-eye="visible" d={`M10 ${eyeY}q4 ${sleepy ? 1 : -1.5} 7 0`} />
        ) : (
          <>
            <path data-eye="far" d={`M-6 ${eyeY}q2 ${sleepy ? 1 : -1} 4 0`} />
            <path data-eye="near" d={`M11 ${eyeY}q3 ${sleepy ? 1 : -1.5} 6 0`} />
          </>
        )}
      </g>
      <g
        data-face-feature="brows"
        fill="none"
        stroke="#655441"
        strokeWidth="1.3"
        strokeLinecap="round"
      >
        <path
          d={
            front
              ? thinking
                ? 'M-14-1q5-4 10-1M6-3q5-1 9 1'
                : 'M-14-2q5-2 10 0M6-2q5-2 9 0'
              : thinking
                ? 'M9-4q5-4 10-1'
                : 'M9-2q5-2 10 0'
          }
        />
      </g>
      {!sleepy && !intentReading && (
        <g data-face-feature="pupils" fill="#4c493b">
          {front ? (
            <>
              <circle cx={thinking ? -8.5 : -9.5} cy={eyeY + 1} r="1.1" />
              <circle cx={thinking ? 10.5 : 9.5} cy={eyeY + 1} r="1.1" />
            </>
          ) : profile ? (
            <circle cx={thinking ? 15 : 13.5} cy={eyeY + 1} r="1.1" />
          ) : (
            <>
              <circle cx={thinking ? -3 : -4} cy={eyeY + 1} r="1" />
              <circle cx={thinking ? 15 : 14} cy={eyeY + 1} r="1.1" />
            </>
          )}
        </g>
      )}
      {intentReading && (
        <g data-face-feature="downward-pupils" fill="#4c493b">
          {front ? (
            <>
              <ellipse cx="-9.5" cy="11" rx="1.2" ry="1.5" />
              <ellipse cx="9.5" cy="11" rx="1.2" ry="1.5" />
            </>
          ) : profile ? (
            <ellipse cx="13" cy="11.5" rx="1.1" ry="1.4" />
          ) : (
            <>
              <ellipse cx="-4" cy="11.5" rx="1" ry="1.3" />
              <ellipse cx="14.5" cy="11.5" rx="1.2" ry="1.5" />
            </>
          )}
        </g>
      )}
      {!profile && (
        <path
          data-face-feature="nose"
          d={front ? 'M0 9v7l3 1' : 'M10 8l3 8-4 1'}
          stroke="#8d6d53"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <HeadDetails appearance={appearance} profile={profile} />
      <g
        data-face-feature="mouth"
        stroke="#805e48"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      >
        {expression === 'talking' ? (
          <ellipse cx={front ? 0 : 12} cy="23" rx="3.7" ry="1.5" fill="#795a48" />
        ) : (
          <path
            d={
              front
                ? expression === 'soft-smile' || expression === 'calm'
                  ? 'M-6 23q6 5 12 0'
                  : expression === 'focused'
                    ? 'M-4 23q4 2 8 0'
                    : 'M-4 23q4 2 8 0'
                : expression === 'soft-smile' || expression === 'calm'
                  ? 'M8 23q5 4 10-1'
                  : expression === 'focused'
                    ? 'M9 23q4 2 8 0'
                    : 'M10 23q4 1 7-1'
            }
          />
        )}
      </g>
    </g>
  )
}
function BackFigure({
  pose,
  hair,
  shirt,
  skin,
  hairColor,
  appearance,
}: {
  pose: Pose
  hair: Hair
  shirt: string
  skin: string
  hairColor: string
  appearance: CharacterAppearance
}) {
  return (
    <g data-anatomy="connected-seated" data-body-view="back">
      {/* A window desk and its screen sit beyond the arms; the back and chair occlude them. */}
      <path d="M-72-12H72v9H-72z" fill="#8b7250" />
      {pose === 'laptop' ? (
        <>
          <path d="M-52-69h104l7 54H-59z" fill="#354941" stroke="#91a08e" strokeWidth="2" />
          <path d="M-46-63h92l5 41H-51z" fill="#637d6c" />
        </>
      ) : (
        <g transform={pose === 'reading' ? 'translate(-20 -32) rotate(-12)' : 'translate(-25 0)'}>
          <path d="M-48-32 0-42l48 10-5 17L0-24l-43 9z" fill="#cfbf98" />
          <path d="M0-42v18m-35 0 24-5m20-3 25 6" stroke="#93876b" strokeWidth="2" />
        </g>
      )}
      <path
        d={
          pose === 'reading'
            ? 'M-27-48Q-50-31-51-51M27-48q23 14 17 29'
            : 'M-27-48Q-50-34-44-19M27-48q23 14 17 29'
        }
        stroke={['cardigan', 'hoodie', 'turtleneck'].includes(appearance.outfit) ? shirt : skin}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
      />
      {pose === 'reading' && <ellipse cx="-51" cy="-51" rx="6" ry="5" fill={skin} />}
      {pose === 'writing' && (
        <>
          <path d="M46-18 58-44" stroke="#313e32" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="46" cy="-24" rx="6" ry="5" fill={skin} />
        </>
      )}
      <path data-joint="neck" d="M-10-85h20v28h-20z" fill={skin} />
      <path d="M-38-48q10-23 28-20h20q18-3 28 20l7 88h-90z" fill={shirt} />
      <path d="M-31-45-38-31M31-45l7 14" stroke={shirt} strokeWidth="20" strokeLinecap="round" />
      <path
        d="M0-59v91m-21-53q20 8 42 0"
        fill="none"
        stroke="#13221c"
        strokeWidth="2"
        opacity=".2"
      />
      <Clothing appearance={appearance} back />
      <g transform="translate(0 -105)">
        <Head
          view="back"
          gaze="forward"
          expression="focused"
          hair={hair}
          skin={skin}
          hairColor={hairColor}
          appearance={appearance}
        />
      </g>
      <g data-depth="chair-in-front">
        <path
          d="M-48 65v-71q0-15 15-15h66q15 0 15 15v71"
          fill="#41473a"
          stroke="#77775c"
          strokeWidth="4"
        />
        <path d="M-35-6h70m-70 14h70m-70 14h70" stroke="#5d6650" strokeWidth="5" />
        <path d="M-42 68h84m-75 0-8 76m64-76 8 76" stroke="#4b4b37" strokeWidth="9" />
      </g>
    </g>
  )
}
/** Small readable palms, with a thumb wrapping the actual prop contact. */
function Palm({
  x,
  y,
  skin,
  contact,
  vertical = false,
}: {
  x: number
  y: number
  skin: string
  contact?: string
  vertical?: boolean
}) {
  return (
    <g
      transform={`translate(${x} ${y})${vertical ? ' rotate(-72)' : ''}`}
      data-contact={contact}
      data-human-detail="palm"
    >
      <path d="M-7-2q-2-4 1-6 3-1 6 3l6 1q4 1 3 5-1 4-7 4l-7-2z" fill={skin} />
      <path
        d="M0 0q3 2 6 1"
        fill="none"
        stroke="#795e48"
        strokeOpacity=".3"
        strokeWidth=".8"
        strokeLinecap="round"
      />
    </g>
  )
}
function Sleeves({ pose, shirt }: { pose: Pose; shirt: string }) {
  return (
    <g data-human-detail="tailored-sleeves" fill={shirt}>
      <path d="M-28-56q-13 1-17 17l-1 12q7 6 17 2l7-20z" />
      <path
        d={
          pose === 'coffee'
            ? 'M23-56q12-3 18 5l4 11-9 6-16-11z'
            : pose === 'conversation'
              ? 'M24-56q13 1 17 13l2 10q-6 6-16 2l-7-17z'
              : 'M25-56q13 2 18 18l2 11q-7 7-17 2l-8-21z'
        }
      />
      <path
        d="M-45-27q7 3 15 0m59 0q7 3 14-1"
        stroke="#17251d"
        strokeOpacity=".16"
        strokeWidth="1.2"
        fill="none"
      />
    </g>
  )
}

function Figure({
  pose,
  role,
  view,
  gaze,
  expression,
  hair,
  shirt,
  skin,
  hairColor,
  appearance,
}: Seat & { shirt: string; skin: string; hairColor: string; appearance: CharacterAppearance }) {
  if (view === 'back')
    return (
      <BackFigure
        pose={pose}
        hair={hair}
        shirt={shirt}
        skin={skin}
        hairColor={hairColor}
        appearance={appearance}
      />
    )
  const longSleeve = ['cardigan', 'hoodie', 'turtleneck'].includes(appearance.outfit)
  const arm = {
    fill: 'none',
    stroke: longSleeve ? shirt : skin,
    strokeWidth: longSleeve ? 12 : 10,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const headX = pose === 'coffee' ? 2 : pose === 'writing' ? 8 : 0
  const headTilt =
    pose === 'reading'
      ? 6
      : pose === 'writing'
        ? 9
        : pose === 'laptop'
          ? 3
          : role === 'listener'
            ? 2
            : -3
  return (
    <g data-anatomy="connected-seated" data-body-view={view}>
      {/* Chair, seated lap and legs remain behind the table, rather than a cut-off torso. */}
      <path
        d="M-48 61v-96q0-19 19-19h47q20 0 20 19v96"
        fill="#30352e"
        stroke="#68684f"
        strokeWidth="3"
      />
      <path d="M-35 43q34-8 66 0l10 32-7 58H16L9 79-5 80l-9 53h-19l-9-58z" fill="#353b35" />
      <path d="M-52 66h102v10H-52z" fill="#4f4c39" />
      <path d="M-38 76l-8 72m79-72 8 72" stroke="#4b4936" strokeWidth="8" />
      {/* The neck overlaps both the head and collar. */}
      <path data-joint="neck" d={`M${headX - 8}-85h16l3 28q-11 9-22 0z`} fill={skin} />
      <path
        d={
          view === 'front'
            ? 'M-40-47q3-18 24-22l5 4q11 8 22 0l5-4q21 4 24 22l3 80q-43 13-86 0z'
            : view === 'profile'
              ? 'M-28-47q7-20 26-23 17 2 30 24l7 79q-30 13-65-1z'
              : 'M-38-47q5-20 24-23 14 12 28 2 19 4 23 22l7 79q-40 13-84-1z'
        }
        fill={shirt}
      />
      <path d="M-11-65q11 9 23 0" fill="none" stroke="#151e18" strokeOpacity=".2" strokeWidth="3" />
      <Clothing appearance={appearance} />
      <g transform={`translate(${headX} -105) rotate(${headTilt})`}>
        <Head
          view={view}
          gaze={gaze}
          expression={expression}
          hair={hair}
          skin={skin}
          hairColor={hairColor}
          appearance={appearance}
        />
      </g>
      {pose === 'reading' && (
        <>
          <path d="M-27-45Q-43-16-39 0q1 6 8 12M27-45Q44-17 42 1q-1 7-9 13" {...arm} />
          <Sleeves pose={pose} shirt={shirt} />
          <path
            d="M-42-2-2-8 43-1 39 23-2 17-42 23z"
            fill="#d4c7a4"
            stroke="#a09272"
            strokeWidth="1.5"
          />
          <path
            d="M-2-7v24m-32-12 23-3m-22 10 22-3M7 3l25 4M7 10l23 4"
            stroke="#a39779"
            strokeWidth="1.5"
          />
          <Palm x={-35} y={13} skin={skin} contact="book" />
          <Palm x={36} y={14} skin={skin} />
        </>
      )}
      {pose === 'laptop' && (
        <>
          <path d="M-26-46Q-39-11-26 2q13 13 45 13M26-44Q43-20 42-6q0 11-7 19" {...arm} />
          <Sleeves pose={pose} shirt={shirt} />
          <path d="M9 15h85l-8 8H4z" fill="#a3a894" />
          <path d="M40-35h64L89 15H29z" fill="#293b35" stroke="#8c9b8d" strokeWidth="3" />
          <path d="M45-29h52L84 8H35z" fill="#536c62" />
          <path d="M13 18h25" stroke="#535e51" strokeWidth="2" />
          <Palm x={18} y={14} skin={skin} contact="keyboard" />
          <Palm x={35} y={13} skin={skin} />
        </>
      )}
      {pose === 'writing' && (
        <>
          <path d="M-26-45Q-41-10-27 8q9 6 22 8M26-44Q49-14 41 0L27 13" {...arm} />
          <Sleeves pose={pose} shirt={shirt} />
          <path d="M-17 3 52 0l8 22-79 4z" fill="#cfc3a2" />
          <path d="M-8 10l35-2m-34 10 25-2" stroke="#9d9477" strokeWidth="1.5" />
          <path d="m25 18 13-27" stroke="#303b32" strokeWidth="3.5" strokeLinecap="round" />
          <Palm x={29} y={12} skin={skin} contact="pen" />
          <Palm x={-5} y={17} skin={skin} />
        </>
      )}
      {pose === 'coffee' && (
        <>
          {/* Raised hand holds the handle near the mouth; the other forearm rests on the table. */}
          <path d="M-26-44Q-44-4-29 8q17 8 40 9M26-45Q46-43 45-62q-1-13-11-20" {...arm} />
          <Sleeves pose={pose} shirt={shirt} />
          <path d="M6-98h26l-2 22q-12 7-22 0z" fill="#d4c6a4" />
          <ellipse cx="19" cy="-98" rx="13" ry="3" fill="#e0d3b4" />
          <path d="M31-94q16-4 14 8-1 9-14 8" stroke="#d4c6a4" strokeWidth="4" fill="none" />
          <Palm x={37} y={-83} skin={skin} vertical contact="cup-handle" />
          <Palm x={11} y={17} skin={skin} />
          <path
            className="steam"
            d="M16-110q-5-9 0-17"
            fill="none"
            stroke="#c8c6af"
            strokeWidth="1.5"
            opacity=".4"
          />
        </>
      )}
      {pose === 'conversation' && (
        <>
          <path d="M-26-44Q-42-7-28 8q16 10 44 9" {...arm} />
          {role === 'speaker' ? (
            <>
              <path d="M26-45q20 25 29 14l12-22" {...arm} />
              <path d="m67-53 2-13m-1 12 9-8" stroke={skin} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M26-44q25 4 20-17L27-84" {...arm} />
              <Palm x={27} y={-85} skin={skin} vertical contact="cheek" />
            </>
          )}
          <Sleeves pose={pose} shirt={shirt} />
          <path d="M17 1h26l-2 20H20z" fill="#c8bc99" />
          <path d="M43 5q16-4 12 8-2 6-12 4" fill="none" stroke="#c8bc99" strokeWidth="3.5" />
          <Palm x={10} y={17} skin={skin} contact="table" />
        </>
      )}
    </g>
  )
}
export default function SceneCompanions({
  background,
  withTable = true,
}: {
  background: Background
  withTable?: boolean
}) {
  const seats = getSceneSeats(background)
  return (
    <g className="focus-companions" aria-hidden="true">
      {seats.map((seat, index) => {
        const appearance = getCharacterAppearance(background.scene, index)
        return (
          <g
            key={appearance.id}
            data-character={appearance.id}
            data-character-quality="human-v2"
            data-outfit={appearance.outfit}
            data-accessory={appearance.accessory}
            data-age={appearance.age}
            data-pose={seat.pose}
            data-view={seat.view}
            data-gaze={seat.gaze}
            data-expression={seat.expression}
            data-hair={appearance.hair}
            data-conversation-role={seat.role}
            data-facing={seat.facing ?? 1}
            transform={`translate(${seat.x} ${getSeatGeometry(background, seat, withTable).y}) scale(${getSeatGeometry(background, seat, withTable).scale * (seat.facing ?? 1)} ${getSeatGeometry(background, seat, withTable).scale})`}
          >
            <Figure
              {...seat}
              hair={appearance.hair}
              shirt={appearance.shirt}
              skin={appearance.skin}
              hairColor={appearance.hairColor}
              appearance={appearance}
            />
          </g>
        )
      })}
      {withTable && seats.length > 0 && <SceneTable scene={background.scene} />}
    </g>
  )
}

export { Head as CharacterHead }
