import { Rear, Foreground } from './SceneLayer'
import { useId } from 'react'
import type { Background } from '../model/backgrounds'
import SceneOutdoorLife from './SceneOutdoorLife'
import RoomWallTexture from './RoomWallTexture'
import SceneCompanions, { CharacterHead } from './SceneCompanions'
import ScenePlants from './ScenePlants'
import ScenePets from './ScenePets'
import SceneAtmosphere from './SceneAtmosphere'
import SceneCaption from './SceneCaption'
import { getCharacterAppearance } from '../model/sceneCast'

function Pendant({ x, y }: { x: number; y: number }) {
  return (
    <g data-scene-fixture="pendant">
      <path d={`M${x} 0v${y}`} stroke="#5c4c34" strokeWidth="4" />
      <path d={`M${x - 25} ${y}h50l38 48h-126z`} fill="#97734a" />
      <ellipse cx={x} cy={y + 48} rx="62" ry="8" fill="#f5d597" />
      <ellipse cx={x} cy={y + 75} rx="110" ry="58" fill="#dfb06c" opacity=".07" />
    </g>
  )
}
function Coffee({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${small ? 0.7 : 1})`}
      data-special-prop="steaming-coffee"
    >
      <ellipse cx="0" cy="38" rx="53" ry="10" fill="#171e19" opacity=".3" />
      <ellipse cx="0" cy="33" rx="47" ry="9" fill="#a5a48b" />
      <path d="M27-1q35-9 30 14-4 17-28 12" stroke="#d8c9a6" strokeWidth="8" fill="none" />
      <path d="M-31-6h64l-5 32q-28 16-54 0z" fill="#d5c8a6" />
      <ellipse cy="-6" rx="32" ry="6" fill="#43362a" />
      <path
        className="steam"
        d="M-13-24q-11-15 0-30m17 29q13-16 2-34m14 35q-8-10-1-23"
        fill="none"
        stroke="#d7d3b9"
        strokeWidth="1.8"
        opacity=".5"
      />
    </g>
  )
}
function Barista() {
  const person = getCharacterAppearance('cafe-barista-long-table', 2)
  return (
    <g
      transform="translate(397 453)"
      data-pose="barista"
      data-character={person.id}
      data-character-quality="human-v2"
      data-view="three-quarter"
      data-gaze="down"
      data-expression="calm"
      data-hair="short"
      data-facing="1"
      data-activity="pouring-coffee"
    >
      <path data-joint="neck" d="M-8-80h16l3 27q-11 7-22 0z" fill={person.skin} />
      <path d="M-38-43q8-19 27-18h22q20-1 27 18l9 111h-94z" fill={person.shirt} />
      <path
        d="M-23-57-19-25h38l4-32m-42 32L-31 68h62L19-25z"
        fill="#796048"
        stroke="#aa8c61"
        strokeWidth="3"
      />
      <path d="M-16 12h32v24h-32z" fill="#64503c" />
      <g transform="translate(0 -101)">
        <CharacterHead
          view="three-quarter"
          gaze="down"
          expression="calm"
          hair={person.hair}
          appearance={person}
          skin={person.skin}
          hairColor={person.hairColor}
        />
      </g>
      <path
        d="M-29-38q-20 22-3 34 12 7 34 1M29-38q21 17 12 30l-5 13"
        fill="none"
        stroke={person.skin}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M-30-42-35-24M30-42l8 17"
        stroke={person.shirt}
        strokeWidth="19"
        strokeLinecap="round"
      />
      <g transform="translate(25 -3) rotate(18)" data-special-prop="pouring-pot">
        <path d="M-14-10q14-10 28 0l4 23h-37z" fill="#a7ac96" />
        <path d="M14-6q24-5 25 10l-17 6" fill="none" stroke="#a7ac96" strokeWidth="7" />
        <path d="M-14-7q-19-13-23 1-2 14 18 12" fill="none" stroke="#a7ac96" strokeWidth="5" />
        <path d="M-8-16h16m-8 0v-7" stroke="#6e7968" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path
        data-contact="pot-handle"
        d="M-6-5q-4-5 0-7 4-1 6 4l6 1q5 2 1 7l-10 1z"
        fill={person.skin}
      />
      <path data-contact="pot-body" d="M30 0q1-6 6-5l7 5q3 3-1 6l-10-1z" fill={person.skin} />
      <path
        d="M61 15q6 12 4 34"
        fill="none"
        stroke="#9c7650"
        strokeWidth="2.5"
        strokeLinecap="round"
        data-special-prop="coffee-stream"
      />
      <path d="M50 46h31l-3 19q-12 8-25 0z" fill="#ded1ad" />
      <path d="M81 50q16-4 13 7-2 8-14 5" stroke="#ded1ad" strokeWidth="4" fill="none" />
    </g>
  )
}
function EspressoMachine() {
  return (
    <g transform="translate(555 418)" data-special-prop="espresso-machine">
      <path d="M-59 0h124v93H-59z" fill="#717d70" />
      <path d="M-65-8H69v20H-65z" fill="#a0a58b" />
      <path d="M-48 31h102v52H-48z" fill="#263730" />
      <circle cx="-27" cy="23" r="9" fill="#d0c7a5" />
      <path d="M-31 23h8m-4-4v8" stroke="#67705f" strokeWidth="2" />
      <path
        d="M10 30v18m31-18v18M1 50h20m11 0h20"
        stroke="#b8bca2"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M-51 85h110v9H-51z" fill="#acb19a" />
      <path d="M-13 12h53" stroke="#3f5045" strokeWidth="4" />
      <path d="M-3 60h17l-2 19H0zM30 60h17l-2 19H33z" fill="#d8cba7" />
      <path d="M79 9h32v42H79zM73 51h44v38H73z" fill="#394c3e" />
      <path d="M82-4h26l4 15H78z" fill="#8f8a6b" />
      <path d="M87 61h15" stroke="#aeb59d" strokeWidth="3" />
    </g>
  )
}
function BaristaRoom({ background }: { background: Background }) {
  return (
    <g data-special-cafe="barista-long-table">
      <Rear>
        <path d="M0 0h800v820H0z" fill="#29291f" />
        <path d="M38 70h724v465H38z" fill="#1b3339" />
        {[80, 230, 420, 610, 735].map((x, i) => (
          <g key={x}>
            <path d={`M${x} ${220 + (i % 3) * 32}h52v270H${x}z`} fill="#243c3d" />
            <path
              d={`M${x + 12} ${265 + (i % 3) * 32}h8m15 0h8m-31 51h8m15 0h8`}
              stroke="#9a8e68"
              strokeWidth="5"
              opacity=".5"
            />
          </g>
        ))}
      </Rear>
      <Foreground>
        <SceneOutdoorLife background={background} />
      </Foreground>
      <Rear>
        <RoomWallTexture scene={35} />
        <path
          d="M36 70h728v465H36zM266 70v465m270-465v465"
          fill="none"
          stroke="#726449"
          strokeWidth="12"
        />
        <path d="M0 535h800v285H0z" fill="#342e22" />
        <path d="M0 715l800-49m-800 110 800-58" stroke="#8f7151" strokeWidth="3" opacity=".22" />
      </Rear>
      <Foreground>
        <Pendant x={165} y={144} />
        <Pendant x={650} y={144} />
        <path data-scene-furniture="barista-counter" d="M74 512h650v23H74z" fill="#aa8256" />
        <path d="M84 535h630v54H84z" fill="#5d4935" />
        <path d="M110 548h580m-580 22h580" stroke="#756044" strokeWidth="3" />
        <EspressoMachine />
        <Barista />
        {/* Counter edge hides the apron hem; guests are seated at the nearer shared table. */}
        <path d="M74 523h650v12H74z" fill="#8c6846" />
        <SceneCompanions background={{ ...background, companions: 2 }} withTable={false} />
        <ScenePets background={background} />
        <path data-scene-furniture="communal-table" d="M24 631 775 607v78L24 717z" fill="#8a6947" />
        <path d="M24 717 775 685v17L24 736z" fill="#59432e" />
        <path d="M74 710v110m652-137v137" stroke="#493c2b" strokeWidth="17" />
        <Coffee x={407} y={641} small />
        <path d="m294 653 52-5 5 26-57 4z" fill="#b4ab8b" />
        <ScenePlants background={background} />
      </Foreground>
    </g>
  )
}
function DomeRoom({ background }: { background: Background }) {
  return (
    <g data-special-cafe="rain-dome">
      <Rear>
        <path d="M0 0h800v820H0z" fill="#272a24" />
        <path d="M0 820V397Q0 20 400 20t400 377v423z" fill="#68604c" />
        <path d="M70 620V390Q70 120 400 120t330 270v230z" fill="#1e363b" />
        <path d="M70 500q200-65 360-18t300-15v153H70z" fill="#254648" />
        <path
          d="M85 530q200-35 400-10t230-8"
          fill="none"
          stroke="#688078"
          strokeWidth="3"
          opacity=".4"
        />
      </Rear>
      <Foreground>
        <SceneOutdoorLife background={background} />
      </Foreground>
      <Rear>
        <RoomWallTexture scene={36} />
        <path
          d="M70 620V390Q70 120 400 120t330 270v230M400 121v499M154 620Q95 320 400 122M646 620Q705 320 400 122"
          fill="none"
          stroke="#b19b73"
          strokeWidth="9"
          data-special-prop="dome-ribs"
        />
        <path d="M0 644q400-66 800 0v176H0z" fill="#514631" />
        <path d="M0 756q400-50 800 0" fill="none" stroke="#8c7854" strokeWidth="3" opacity=".3" />
      </Rear>
      <Foreground>
        <Pendant x={400} y={255} />
        <path d="m344 306-113 330h338L456 306z" fill="#edb960" opacity=".055" />
        <path d="M22 565v-140m756 140v-140" stroke="#8d7957" strokeWidth="10" />
        <ellipse cx="22" cy="424" rx="19" ry="29" fill="#e2b76f" />
        <ellipse cx="778" cy="424" rx="19" ry="29" fill="#e2b76f" />
        <SceneCompanions background={background} withTable={false} />
        <ScenePets background={background} />
        <path
          data-scene-furniture="dome-table"
          d="M105 628q295-55 590 0v88q-295-36-590 0z"
          fill="#91714e"
        />
        <path d="M127 680v140m546-140v140" stroke="#493f2d" strokeWidth="18" />
        <Coffee x={402} y={635} small />
        <ScenePlants background={background} />
        <path d="M163 655q73-28 136-6l-8 37q-61-18-120 2z" fill="#b5a180" />
        <path d="m175 660 99-8m-96 21 91-8" stroke="#d4c09c" strokeWidth="2" opacity=".6" />
      </Foreground>
    </g>
  )
}
export default function SpecialCafeScenes({
  background,
  thumbnail = false,
  paused = false,
  artOnly = false,
}: {
  background: Background
  thumbnail?: boolean
  paused?: boolean
  artOnly?: boolean
}) {
  const id = useId().replace(/:/g, '')
  return (
    <div
      className={`cafe background-scene special-cafe${thumbnail ? ' scene-thumbnail' : ''}`}
      data-testid={thumbnail || artOnly ? undefined : 'cafe-scene'}
      data-presence="shared"
      role="img"
      aria-label={background.description}
    >
      <svg viewBox="0 0 800 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}-warm`}>
            <stop stopColor="#e1ad62" stopOpacity=".1" />
            <stop offset="1" stopColor="#e1ad62" stopOpacity="0" />
          </radialGradient>
        </defs>
        {background.scene === 35 ? (
          <BaristaRoom background={background} />
        ) : (
          <DomeRoom background={background} />
        )}
        <Foreground>
          <ellipse cx="400" cy="510" rx="410" ry="360" fill={`url(#${id}-warm)`} />
          <path d="M0 0h800v820H0z" fill="#07100e" opacity=".08" />
        </Foreground>
      </svg>
      {!artOnly && (
        <SceneAtmosphere backgroundId={background.id} static={thumbnail} paused={paused} />
      )}
      {!thumbnail && !artOnly && (
        <>
          <div className="scene-grain" />
          <SceneCaption name={background.name} />
        </>
      )}
    </div>
  )
}
