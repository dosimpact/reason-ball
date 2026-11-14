import {
  SceneLayerContext,
  Rear,
  Foreground,
  useSceneLayer,
  type SceneLayerMode,
} from './SceneLayer'
import { useId } from 'react'
import PremiumScene from './premium/PremiumScene'
import { getPremiumSpace } from '../model/premiumSpaces'
import { getBackground, type Background } from '../model/backgrounds'
import './backgrounds.css'
import SceneAtmosphere from './SceneAtmosphere'
import SceneCompanions from './SceneCompanions'
import ScenePlants from './ScenePlants'
import ScenePets from './ScenePets'
import SceneCaption from './SceneCaption'
import LegacyOutdoorFixtures from './LegacyOutdoorFixtures'
import SceneOutdoorLife from './SceneOutdoorLife'
import { getSceneArchitecture } from '../model/sceneArchitecture'
import RoomWallTexture from './RoomWallTexture'
import RoomLighting from './RoomLighting'
import SceneTable from './SceneTable'
import { getSceneInterior } from '../model/sceneInterior'
import RoomFurnishings from './RoomFurnishings'
import RoomWindow from './RoomWindow'
import NeonCityArt from './NeonCityArt'
import SpecialCafeScenes from './SpecialCafeScenes'
import SongInspiredArt, { SongInspiredFurnishings } from './SongInspiredArt'
import AutumnScenery, { AutumnFallingLeaves } from './AutumnScenery'
import { getAutumnSpace } from '../model/sceneAutumn'
function OriginalCafe({
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
  const uid = useId().replace(/:/g, '')
  const ref = (name: string) => `url(#${uid}-${name})`
  return (
    <div
      className={`cafe${thumbnail ? ' scene-thumbnail' : ''}`}
      data-testid={thumbnail || artOnly ? undefined : 'cafe-scene'}
      data-presence={background.companions ? 'shared' : 'solo'}
      role="img"
      aria-label={background.description}
    >
      <svg viewBox="0 0 800 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-room`} x2="1" y2="1">
            <stop stopColor="#252a24" />
            <stop offset="1" stopColor="#121a18" />
          </linearGradient>
          <linearGradient id={`${uid}-night`} x2="0" y2="1">
            <stop stopColor="#152a32" />
            <stop offset=".65" stopColor="#263c40" />
            <stop offset="1" stopColor="#40504a" />
          </linearGradient>
          <radialGradient id={`${uid}-warm`}>
            <stop stopColor="#e7b367" stopOpacity=".3" />
            <stop offset="1" stopColor="#cfa467" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-table`} x2="0" y2="1">
            <stop stopColor="#786046" />
            <stop offset=".1" stopColor="#5c4835" />
            <stop offset="1" stopColor="#29271f" />
          </linearGradient>
          <linearGradient id={`${uid}-cup`} x2="1" y2=".5">
            <stop stopColor="#c8c2a8" />
            <stop offset=".5" stopColor="#eee4c7" />
            <stop offset="1" stopColor="#9f9d84" />
          </linearGradient>
          {!thumbnail && (
            <filter id={`${uid}-blur`}>
              <feGaussianBlur stdDeviation="9" />
            </filter>
          )}
          {!thumbnail && (
            <filter id={`${uid}-glow`}>
              <feGaussianBlur stdDeviation="3" />
            </filter>
          )}
          <pattern
            id={`${uid}-rain`}
            width="77"
            height="130"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(13)"
          >
            <path
              d="M12 0v41 M44 65v61 M65 29v19"
              stroke="#bad1ce"
              strokeOpacity=".24"
              strokeWidth="1.2"
            />
            <path d="M27 97v11" stroke="#e2e6d7" strokeOpacity=".4" />
          </pattern>
        </defs>
        <Rear>
          <path fill={ref('room')} d="M0 0h800v820H0z" />
          <path fill={ref('night')} d="M45 0h653v619H45z" />
          <g fill="#15282d" opacity=".7">
            <path d="M50 305h81v270H50zM137 233h105v335H137zM258 280h62v320h-62zM338 190h120v420H338zM483 302h75v290h-75zM582 250h110v360H582z" />
          </g>
          <g filter={thumbnail ? undefined : ref('blur')} opacity=".7" fill="#cead6d">
            <circle cx="116" cy="458" r="9" />
            <circle cx="263" cy="491" r="7" />
            <circle cx="460" cy="447" r="12" />
            <circle cx="592" cy="480" r="8" />
            <path d="M111 488h9v106h-9zM454 479h10v120h-10z" opacity=".25" />
          </g>
        </Rear>
        <Foreground>
          <SceneOutdoorLife background={background} />
        </Foreground>
        <Rear>
          <RoomWallTexture scene={0} />
          <g fill="none" stroke="#aec5bf" strokeOpacity=".2">
            <path d="M163 0q-9 95 0 165t-5 164q-9 94 3 185M509 11q-13 98-2 163t-5 159M629 95q-9 107 2 167t-3 218" />
          </g>
          <path
            fill="#323b32"
            d="M38 0h18v636H38zM354 0h16v625h-16zM690 0h19v650h-19zM45 598h656v21H45z"
          />
          <path fill="#85836b" opacity=".2" d="M56 0h3v599h-3zM371 0h3v599h-3z" />
        </Rear>
        <Foreground>
          <defs>
            <clipPath id={`${uid}-warm-boundary`}>
              <path d="M0 0H710V820H0Z" />
            </clipPath>
          </defs>
          <ellipse
            clipPath={`url(#${uid}-warm-boundary)`}
            fill={ref('warm')}
            cx="630"
            cy="300"
            rx="310"
            ry="370"
          />
          <path data-scene-fixture="pendant" stroke="#292a22" strokeWidth="5" d="M574 0v112" />
          <path fill="#8b7350" d="M558 111h33l42 69H515z" />
          <ellipse fill="#e7c887" cx="574" cy="180" rx="59" ry="8" />
          <ellipse
            fill="#ffe4a5"
            cx="574"
            cy="182"
            rx="43"
            ry="3"
            filter={thumbnail ? undefined : ref('glow')}
          />
        </Foreground>
        <Rear>
          <path fill="#1e2921" d="M710 0h90v700h-90z" />
        </Rear>
        <Foreground>
          <ScenePlants background={background} />
          <SceneCompanions background={background} withTable={false} />
          <ScenePets background={background} />
          <path data-scene-furniture="writing-table" fill={ref('table')} d="M0 665l800-40v195H0z" />
          <path
            stroke="#9d805b"
            strokeOpacity=".25"
            d="M0 700l800-47M0 763l800-71M59 820l665-106"
          />
          <g transform="translate(130 662) rotate(-7)">
            <path fill="#292d28" d="M0 0h166v97H0z" />
            <path fill="#a6a18b" d="M8-5h149v91H8z" />
            <path fill="#d1c7ab" d="M13-8h147v89H13z" />
            <path stroke="#a8a28c" strokeWidth="1" d="M26 12h116M26 24h116M26 36h116M26 48h70" />
            <path stroke="#4c5046" strokeWidth="5" d="M126 9l-33 75" />
          </g>
          <ellipse fill="#171d18" opacity=".4" cx="490" cy="725" rx="101" ry="15" />
          <ellipse fill="#979b82" cx="479" cy="713" rx="72" ry="13" />
          <ellipse fill="#c2bda2" cx="479" cy="710" rx="66" ry="10" />
          <path fill="none" stroke="#b9b79e" strokeWidth="12" d="M524 651c57-19 48 46 3 35" />
          <path fill={ref('cup')} d="M427 644h105l-9 51q-38 24-86 0z" />
          <ellipse fill="#d7cdb1" cx="479" cy="644" rx="53" ry="10" />
          <ellipse fill="#483a2c" cx="479" cy="644" rx="45" ry="6" />
          <g className="steam" stroke="#d9d7be" fill="none" strokeWidth="2" opacity=".32">
            <path d="M464 619q-15-19 1-36t-4-34M484 626q20-25 3-45t3-39M505 614q-15-13-2-34" />
          </g>
          <path fill="#101813" opacity=".45" d="M0 802q350-35 800-10v28H0z" />
        </Foreground>
      </svg>
      {!artOnly && <SceneAtmosphere backgroundId="cafe-rain" static={thumbnail} paused={paused} />}
      {!thumbnail && !artOnly && (
        <>
          <div className="scene-grain" />
          <SceneCaption name={background.name} />
        </>
      )}
    </div>
  )
}

function CozyRoom({ background }: { background: Background }) {
  const { companions } = background
  const glow = useId().replace(/:/g, '')
  const interior = getSceneInterior(background.scene)
  return (
    <g className="cozy-room" aria-hidden="true">
      <defs>
        <radialGradient id={`${glow}-ambient`}>
          <stop stopColor="#edc27d" stopOpacity=".10" />
          <stop offset=".55" stopColor="#edc27d" stopOpacity=".035" />
          <stop offset="1" stopColor="#edc27d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${glow}-bulb`}>
          <stop stopColor="#ffe1a5" stopOpacity=".35" />
          <stop offset=".4" stopColor="#f0c077" stopOpacity=".13" />
          <stop offset="1" stopColor="#f0c077" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Rear>
        <RoomWindow scene={background.scene} wall={interior.wall.color} wood={interior.trim} />
      </Rear>
      <Foreground>
        <defs>
          <clipPath id={`${glow}-old-floor-occlusion`}>
            <path d="M0 0H800V580H0Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${glow}-old-floor-occlusion)`}>
          <RoomInterior n={background.scene} />
        </g>
        {background.scene === 30 && <SongInspiredFurnishings scene={30} />}
      </Foreground>
      <Rear>
        {interior.enclosure === 'terrace' ? (
          <g data-terrace-deck="open">
            <path d="M0 650H800V820H0Z" fill={interior.floor} />
            <path
              d="M0 690 800 650M0 750 800 700M80 820 300 650M650 820 520 650"
              stroke={interior.trim}
              strokeWidth="3"
              opacity=".23"
            />
          </g>
        ) : (
          <>
            <path
              d={background.scene === 12 ? 'M0 610h800v210H0z' : 'M0 580h800v240H0z'}
              fill={interior.wall.color}
            />
            <path d="M0 658l800-38v200H0z" fill={interior.floor} />
            <path
              d="M0 704l800-43M0 770l800-62M120 820l520-180"
              fill="none"
              stroke="#b18b5e"
              strokeWidth="3"
              opacity=".22"
            />
          </>
        )}
      </Rear>
      <Foreground>
        {background.scene === 9 ? (
          <MoonlitInteriorCast ambient={`url(#${glow}-ambient)`} />
        ) : (
          <ellipse cx="400" cy="565" rx="370" ry="250" fill={`url(#${glow}-ambient)`} />
        )}
        <RoomLighting scene={background.scene} />
        <RoomFurnishings scene={background.scene} />
        {companions > 0 ? (
          <SceneCompanions background={background} />
        ) : (
          <g className="solo-nook">
            <SceneTable scene={background.scene} occupied={false} />
            <path d="M322 635l78-20 78 20-5 25-73-15-73 15z" fill="#d1c49d" />
            <path d="M400 617v28" stroke="#9a8c6d" strokeWidth="2" />
            <path d="M507 615h55l-7 37q-19 14-41 0z" fill="#c8b998" />
            <path
              d="M559 620q35-12 29 20-5 19-28 10"
              fill="none"
              stroke="#c8b998"
              strokeWidth="8"
            />
            <path
              className="steam"
              d="M524 592q-10-17 4-30m16 30q13-18 2-32"
              fill="none"
              stroke="#d7c9a8"
              strokeWidth="2"
              opacity=".55"
            />
          </g>
        )}
        <ScenePlants background={background} />
      </Foreground>
    </g>
  )
}

const trees = (color = '#132b29', autumn = false) =>
  Array.from({ length: 10 }, (_, i) => {
    const x = i * 96 - 35,
      y = 210 + (i % 3) * 40
    return (
      <g key={i}>
        <path d={`M${x} ${y}v510`} stroke="#25392e" strokeWidth={14} />
        {autumn ? (
          <>
            <ellipse cx={x} cy={y + 50} rx="76" ry="105" fill={i % 2 ? '#624635' : '#775137'} />
            <ellipse cx={x + 35} cy={y + 100} rx="62" ry="70" fill="#514736" />
          </>
        ) : (
          <path
            d={`M${x} ${y - 90}l-85 210h48l-85 130h65l-70 115h254l-70-115h65l-85-130h48z`}
            fill={color}
          />
        )}
      </g>
    )
  })
function Mug({ x = 400, y = 690 }: { x?: number; y?: number }) {
  if (useSceneLayer() === 'rear') return null
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy="38" rx="57" ry="10" fill="#878a75" />
      <path d="M30-5c45-12 42 35 0 26" fill="none" stroke="#c8c0a1" strokeWidth="9" />
      <path d="M-36-10h73l-8 40q-27 18-57 0z" fill="#d1c5a6" />
      <ellipse cy="-10" rx="36" ry="7" fill="#493c2d" />
    </g>
  )
}
function Bench({ x = 220, y = 600 }: { x?: number; y?: number }) {
  if (useSceneLayer() === 'rear') return null
  return (
    <g transform={`translate(${x} ${y})`} stroke="#806347" strokeWidth="12">
      <path d="M0 0h290M0 25h290M-12 64h314M25 68v70M262 68v70" />
      <path d="M12-14v80M278-14v80" stroke="#344137" strokeWidth="9" />
    </g>
  )
}
function Books({ x = 50, y = 160 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path fill="#342e27" d="M0 0h200v420H0z" />
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={12 + i * 20}
              y={20 + row * 100 + (i % 3) * 5}
              width={14}
              height={68 - (i % 3) * 5}
              fill={['#68624c', '#665048', '#3d5650', '#827155'][i % 4]}
            />
          ))}
          <path d={`M0 ${95 + row * 100}h200`} stroke="#8a7150" strokeWidth="7" />
        </g>
      ))}
    </g>
  )
}
/** Wall-mounted side bays leave both twin arches and their outer frame strokes open. */
function LibrarySideCases() {
  return (
    <g data-furnishing="library-shelves" data-support="wall-fasteners">
      {[8, 735].map((x, side) => (
        <g key={x} transform={`translate(${x} 180)`}>
          <path d="M3 4h54v390H3z" fill="#141d18" opacity=".35" />
          <path d="M0 0h57v394H0z" fill="#594f3d" />
          <path d="M5 7h47v379H5z" fill="#292c25" />
          <path d="M0 0h57v7H0zM0 387h57v7H0z" fill="#867556" />
          {[0, 1, 2, 3].map((row) => (
            <g key={row}>
              {Array.from({ length: 4 }, (_, i) => (
                <g key={i}>
                  {!(side === 1 && row === 0) && (
                    <>
                      <rect
                        x={9 + i * 10}
                        y={23 + row * 95 + (i % 2) * 7}
                        width={i % 2 ? 8 : 9}
                        height={66 - (i % 2) * 7}
                        fill={['#757054', '#526b5d', '#8a7656', '#6f5b4e'][(i + row) % 4]}
                      />
                      <path
                        d={`M${11 + i * 10} ${36 + row * 95 + (i % 2) * 7}h4`}
                        stroke="#b0a17b"
                        strokeWidth="1"
                        opacity=".35"
                      />
                    </>
                  )}
                </g>
              ))}
              <path d={`M3 ${95 + row * 95}h51v5H3z`} fill="#8a7756" />
            </g>
          ))}
          {[13, 364].map((y) => (
            <g key={y}>
              <path d={`M0 ${y}h6v15H0zM51 ${y}h6v15h-6z`} fill="#958769" />
              <circle cx="3" cy={y + 7} r="1.5" fill="#3b4436" />
              <circle cx="54" cy={y + 7} r="1.5" fill="#3b4436" />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}
/** A cool, lightly cratered gibbous moon retains the room's original circular silhouette. */
function MoonlitSky() {
  const id = useId().replace(/:/g, '')
  return (
    <g data-scene-detail="moon-surface">
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#bfdbe2" stopOpacity=".2" />
          <stop offset=".36" stopColor="#8fb8cc" stopOpacity=".12" />
          <stop offset=".72" stopColor="#7ca5c0" stopOpacity=".035" />
          <stop offset="1" stopColor="#6b94b1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-stone`} cx=".3" cy=".28" r=".9">
          <stop stopColor="#e0e5d5" />
          <stop offset=".55" stopColor="#c3d0c7" />
          <stop offset="1" stopColor="#8ca8ac" />
        </radialGradient>
        <linearGradient id={`${id}-terminator`}>
          <stop stopColor="#527b8c" stopOpacity="0" />
          <stop offset=".45" stopColor="#527b8c" stopOpacity=".05" />
          <stop offset="1" stopColor="#426b81" stopOpacity=".46" />
        </linearGradient>
        <clipPath id={`${id}-surface`}>
          <circle cx="480" cy="205" r="54" />
        </clipPath>
      </defs>
      <path fill="#283e4c" d="M0 0h800v820H0z" />
      <circle cx="400" cy="300" r="218" fill="#294550" />
      <circle cx="480" cy="205" r="154" fill={`url(#${id}-halo)`} />
      <circle cx="480" cy="205" r="103" fill={`url(#${id}-halo)`} opacity=".72" />
      <circle cx="480" cy="205" r="72" fill={`url(#${id}-halo)`} opacity=".8" />
      <circle cx="480" cy="205" r="54" fill={`url(#${id}-stone)`} />
      <g clipPath={`url(#${id}-surface)`}>
        <path d="M497 145q-24 38-12 66t-7 58h64V145z" fill={`url(#${id}-terminator)`} />
        <path
          d="M443 174q13-12 24-3t17 3q-2 15-16 16t-22-5zM452 211q14-7 23 0t9 17q-10 8-24 2z"
          fill="#8da9aa"
          opacity=".16"
        />
        {[
          [450, 184, 8, 6],
          [467, 165, 5, 4],
          [491, 179, 10, 8],
          [470, 208, 9, 7],
          [447, 224, 5, 6],
          [492, 231, 7, 6],
          [512, 211, 5, 7],
          [474, 246, 4, 3],
        ].map(([x, y, rx, ry]) => (
          <g key={`${x}-${y}`}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#76949e" opacity=".17" />
            <path
              d={`M${x - rx * 0.7} ${y + ry * 0.1}q${rx * 0.7} ${ry * 1.1} ${rx * 1.4} 0`}
              fill="none"
              stroke="#edf0dc"
              strokeWidth="1.1"
              opacity=".35"
            />
          </g>
        ))}
        <path d="m440 201 4 1m37 35 3 2m15-39 4-1" stroke="#a6bbb7" strokeWidth="1.8" />
      </g>
      <circle
        cx="480"
        cy="205"
        r="53.5"
        fill="none"
        stroke="#d4e2da"
        strokeWidth="1"
        opacity=".36"
      />
    </g>
  )
}
/** The cool pool ends transparently inside the 800×820 core; furniture is painted after it. */
function MoonlitInteriorCast({ ambient }: { ambient: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <g data-scene-light="bounded-moonlight">
      <defs>
        <radialGradient id={`${id}-blue`}>
          <stop stopColor="#91bfd7" stopOpacity=".23" />
          <stop offset=".42" stopColor="#719fbf" stopOpacity=".14" />
          <stop offset=".76" stopColor="#628bad" stopOpacity=".045" />
          <stop offset="1" stopColor="#537a9c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-floor`}>
          <stop stopColor="#a1cadf" stopOpacity=".16" />
          <stop offset=".55" stopColor="#719cb8" stopOpacity=".07" />
          <stop offset="1" stopColor="#537a9c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="400" cy="565" rx="370" ry="250" fill={ambient} />
      <ellipse cx="480" cy="548" rx="258" ry="246" fill={`url(#${id}-blue)`} />
      <ellipse cx="475" cy="720" rx="222" ry="64" fill={`url(#${id}-floor)`} />
    </g>
  )
}
/** The snow sits on pitched roof planes, with a darker timber gable and an exposed return. */
function SnowLodgeExterior() {
  const id = useId().replace(/:/g, '')
  return (
    <g data-scene-detail="snow-lodge-depth">
      <defs>
        <clipPath id={`${id}-gable`}>
          <path d="M130 430 365 218 600 430Z" />
        </clipPath>
        <clipPath id={`${id}-roof`}>
          <path d="m365 218 45-18 300 210-110 25z" />
        </clipPath>
      </defs>
      <path d="M550 300V175h45v165" fill="#666c5c" />
      <path d="M582 175h16v165h-16z" fill="#4c5c52" />
      <path d="M542 171h65v12h-65z" fill="#8e9b8c" />
      <path d="M539 168q15-5 30-1t42 0l-5 7h-64z" fill="#c2cdbf" />
      <path
        d="M554 198h29m-21 23h25m-33 24h30m-23 25h26"
        stroke="#8c9683"
        strokeWidth="3"
        opacity=".55"
      />
      <path d="M575 165q-44-64-2-115" stroke="#a8b7aa" opacity=".2" strokeWidth="15" fill="none" />
      <path d="M168 424h410v296H168z" fill="#68634e" />
      <path d="m578 424 117-28v300l-117 24z" fill="#4d594c" />
      <path d="M180 431h14v289h-14zM555 431h15v289h-15z" fill="#8a7b5c" />
      {[458, 491, 524, 557, 590, 623, 656, 689].map((y) => (
        <g key={y}>
          <path d={`M193 ${y}h362m23-3 112-23`} stroke="#8e8061" strokeWidth="3" opacity=".55" />
          <path d={`M205 ${y + 5}h335`} stroke="#4c5141" strokeWidth="2" opacity=".35" />
        </g>
      ))}
      <path d="M130 430 365 218 600 430Z" fill="#73745c" />
      <g clipPath={`url(#${id}-gable)`} stroke="#a2a084" strokeWidth="3" opacity=".35">
        {[270, 298, 326, 354, 382, 410].map((y) => (
          <path key={y} d={`M145 ${y}h450`} />
        ))}
      </g>
      <path d="m365 218 45-18 300 210-110 25z" fill="#67766a" />
      <path d="m365 218 45-18 300 210-23-2q-14 7-31 3l-25 9q-17-4-31 7z" fill="#c1cec1" />
      <g clipPath={`url(#${id}-roof)`} fill="none" stroke="#849688" strokeWidth="2" opacity=".5">
        <path d="m399 239 43-11m-17 33 47-12m-18 35 50-13m-16 35 56-14m-21 39 63-16m-22 39 70-18m-23 42 80-20" />
        <path d="m436 251 12 12m36 19 13 12m34 22 14 11m35 22 15 11m33 22 16 12" />
      </g>
      <path d="M128 431h472v13H128z" fill="#3f4d41" />
      <path d="m600 431 110-23v14l-110 23z" fill="#46564a" />
      <path d="m117 428 243-213 50-15-44 28-224 209q-14 2-25-9z" fill="#d2d9c8" />
      <path
        d="M137 434q57-4 108 1t104-1 109 1 134-2"
        fill="none"
        stroke="#a2b3a2"
        strokeWidth="5"
      />
      {[177, 235, 524, 578].map((x, i) => (
        <path
          key={x}
          d={`M${x} 438v${i % 2 ? 12 : 8}`}
          stroke="#b4c8ba"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      <circle cx="365" cy="345" r="27" fill="#a4a88a" stroke="#535f4d" strokeWidth="7" />
      <circle cx="365" cy="345" r="21" fill="#c1b888" />
      <path d="M365 323v44m-22-22h44" stroke="#727c60" strokeWidth="4" />
      {[235, 455].map((x) => (
        <g key={x}>
          <path d={`M${x - 7} 480h95v96h-95z`} fill="#384c40" />
          <path d={`M${x} 487h81v77h-81z`} fill="#b8ab7a" />
          <path d={`M${x + 40} 487v77m-40-39h81`} stroke="#756c4c" strokeWidth="5" />
          <path d={`M${x - 10} 478q49-8 101 0v8h-101z`} fill="#c6cdb8" />
          <path d={`M${x - 9} 572h100v8h-100z`} fill="#8d8060" />
          <path d={`M${x + 5} 491h25v29h-25z`} fill="#d6c58e" opacity=".22" />
        </g>
      ))}
      <path d="M363 548h66v172h-66z" fill="#334a3f" stroke="#8c7b58" strokeWidth="7" />
      <path d="M376 564h39v44h-39z" fill="#aea87b" />
      <path d="M395 565v42m-18-21h37" stroke="#687458" strokeWidth="3" />
      <circle cx="415" cy="637" r="3" fill="#baa16c" />
      <path d="M345 720h99l9 12H335z" fill="#aab8a6" />
      <path d="M230 820l140-88h80l180 88" fill="#a5b1a0" />
      <path d="M0 710q180-45 310 35l-80 75H0zM560 750q150-80 240-40v110H630z" fill="#a7b3a2" />
    </g>
  )
}
function RoomInterior({ n }: { n: number }) {
  switch (n) {
    case 5:
      return (
        <>
          <Books />
          <Books x={550} />
          <path d="M265 300h265v350H265z" fill="#71624b" />
          <path d="M295 390q105-145 205 0v220H295z" fill="#1b2520" />
          <path d="M325 590q-20-65 40-110-5 55 35 65 35-80 38-110 75 95 36 155" fill="#c18b4e" />
          <path d="M290 650h215" stroke="#9a7850" strokeWidth="18" />
          <path
            d="M70 820V640q0-65 65-65h80q65 0 65 65v180M520 820V680q0-65 65-65h80q65 0 65 65v140"
            fill="#4d5140"
          />
          <Mug x={410} y={720} />
        </>
      )
    case 7:
      return <LibrarySideCases />
    default:
      return null
  }
}
function SceneArt({ n }: { n: number }) {
  if (n === 37) return <NeonCityArt />
  if (n === 30) return <AutumnScenery scene={n} />
  if (n >= 30) return <SongInspiredArt scene={n} />
  const hills = (
    <>
      <path d="M0 440L160 210 330 410 550 170 800 420V820H0z" fill="#223a3d" />
      <path d="M0 530L250 350 430 530 650 330 800 450V820H0z" fill="#1a302f" />
    </>
  )
  const city = (
    <g fill="#1b3035">
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i}>
          <rect x={i * 74 - 20} y={230 + (i % 4) * 50} width="60" height="420" />
          {[0, 1, 2, 3].map((r) => (
            <path
              key={r}
              d={`M${i * 74 - 8} ${270 + (i % 4) * 50 + r * 56}h8m18 0h8`}
              stroke={i % 3 ? '#877550' : '#45615f'}
              strokeWidth="7"
            />
          ))}
        </g>
      ))}
    </g>
  )
  const desk = (
    <>
      <path d="M0 650l800-35v205H0z" fill="#554534" />
      <path d="M0 685l800-35M0 755l800-48" stroke="#827055" opacity=".28" />
      <Mug />
    </>
  )
  switch (n) {
    case 1:
      return (
        <>
          {city}
          <path d="M0 820L350 470h100l350 350" fill="#33433f" />
          <AutumnScenery scene={1} />
          <path d="M0 150h285v540H0zM540 0h260v740H540z" fill="#182724" />
          <path d="M40 310h200v240H40z" fill="#a47a44" />
          <path d="M52 323h176v214H52z" fill="#594d32" />
          <path d="M133 322v214M50 433h180" stroke="#252d25" strokeWidth="9" />
          <path d="M14 285h250l-27 37H28z" fill="#746047" />
          <path d="M565 220h190v75H565z" fill="#536455" />
          <path
            d="M350 650l-110 170m270-170 110 170"
            stroke="#ac9663"
            opacity=".25"
            strokeWidth="10"
          />
          <Mug x={145} y={560} />
        </>
      )
    case 2:
      return (
        <>
          {trees('#244438')}
          <path d="M30 70h740v590H30z" fill="#58766a" opacity=".12" />
          {[70, 650].map((x) => (
            <g key={x}>
              <path
                d={`M${x} 650q-60-220 20-390m-20 290q110-180 80-270`}
                stroke="#5c7955"
                strokeWidth="8"
                fill="none"
              />
              {[0, 1, 2, 3].map((i) => (
                <ellipse
                  key={i}
                  cx={x + (i % 2) * 60}
                  cy={340 + i * 65}
                  rx="43"
                  ry="18"
                  transform={`rotate(-25 ${x} ${340 + i * 65})`}
                  fill="#3e6048"
                />
              ))}
            </g>
          ))}
          <ellipse cx="400" cy="660" rx="180" ry="42" fill="#715a3f" />
          <path d="M400 665v155" stroke="#463b2c" strokeWidth="24" />
          <Mug x={410} y={610} />
        </>
      )
    case 3:
      return (
        <>
          {city}
          <path d="M0 570h800v250H0z" fill="#373c32" />
          <path
            d="M0 540h800M60 540v130M240 540v130M420 540v130M600 540v130M780 540v130"
            stroke="#687064"
            strokeWidth="9"
          />
          <LegacyOutdoorFixtures scene={3} />
          <Bench x={420} y={620} />
          <ellipse cx="200" cy="670" rx="110" ry="30" fill="#8a7050" />
          <path d="M200 680v140" stroke="#514735" strokeWidth="12" />
          <Mug x={200} y={625} />
        </>
      )
    case 4:
      return (
        <>
          <path d="M0 390h800v430H0z" fill="#304c50" />
          {[420, 470, 540, 610].map((y) => (
            <path
              key={y}
              d={`M0 ${y}q150-20 300 0t500 0`}
              fill="none"
              stroke="#73918a"
              opacity=".3"
              strokeWidth="3"
            />
          ))}
          <path d="M0 600h800v48H0z" fill="#8b6c47" />
          <path d="M0 648h800v172H0z" fill="#302f26" />
          <path
            d="M170 700h140v25H170zM520 700h140v25H520zM190 720l-20 100m120-100 20 100m230-100-20 100m120-100 20 100"
            stroke="#715d43"
            strokeWidth="14"
          />
          <Mug x={270} y={560} />
        </>
      )
    case 5:
      return null
    case 6:
      return (
        <>
          {hills}
          <path d="M0 0h800v820H0zM160 70L650 50 720 460H110z" fill="#33362c" fillRule="evenodd" />
          {desk}
          <path d="M450 685l150-10 15 90-150 10z" fill="#c2b796" />
        </>
      )
    case 7:
      return <path d="M0 0h800v820H0z" fill="#262d26" />
    case 8:
      return <>{city}</>
    case 9:
      return (
        <>
          <MoonlitSky />
          <path d="M180 300h440M400 80v440" stroke="#82745a" strokeWidth="12" />
          {desk}
          <path d="M180 700l220-35 220 35-8 90-212-32-212 32z" fill="#c2b99c" />
          <path
            d="M400 668v90m-195-39 165-26m-160 44 160-25m55-20 165 26m-165-8 165 25"
            stroke="#8c8e79"
            strokeWidth="2"
          />
        </>
      )
    case 10:
      return (
        <>
          {trees('#314b46')}
          <path d="M0 380q400-70 800 20v130q-400-60-800 20z" fill="#a0b3a0" opacity=".12" />
          {trees('#1c3632')}
          <path d="M0 650q400-120 800 0v170H0z" fill="#172c28" />
          <path
            d="M300 820q250-180 140-260"
            stroke="#657567"
            strokeWidth="55"
            opacity=".2"
            fill="none"
          />
        </>
      )
    case 11:
      return (
        <>
          {trees()}
          <path d="M190 500l210-180 230 180z" fill="#5e5541" />
          <path d="M220 495h380v230H220z" fill="#493d2e" />
          <path d="M250 540h100v100H250zM460 540h100v100H460z" fill="#c6a468" />
          <path
            d="M285 540v100m-35-50h100m160-50v100m-50-50h100"
            stroke="#65563a"
            strokeWidth="8"
          />
          <path d="M380 570h66v155h-66z" fill="#242e27" />
          <path d="M340 820l40-95h66l100 95" fill="#665d45" />
          <path d="M510 400V290h40v145" fill="#594d39" />
        </>
      )
    case 12:
      return (
        <>
          {trees()}
          <path d="M100 820q70-150 330-220t-40-180" stroke="#495744" strokeWidth="95" fill="none" />
          <LegacyOutdoorFixtures scene={12} />
          <path
            d="M0 740q160-140 260 80M800 720q-140-120-220 100"
            stroke="#284334"
            fill="none"
            strokeWidth="40"
          />
        </>
      )
    case 13:
      return (
        <>
          <path d="M0 0h800v820H0z" fill="#223d35" />
          {Array.from({ length: 15 }, (_, i) => (
            <g key={i} transform={`translate(${i * 62 - 20}) rotate(${i % 2 ? 5 : -4} 400 820)`}>
              <path
                d="M0 0v820"
                stroke={i % 2 ? '#49694c' : '#365b43'}
                strokeWidth={i % 2 ? 17 : 24}
              />
              {[120, 290, 460, 630].map((y) => (
                <g key={y}>
                  <path d={`M-12 ${y}h25`} stroke="#698063" strokeWidth="4" />
                  <path
                    d={`M0 ${y}q70-65 120-40-65 45-120 40M0 ${y}q-70-65-100-25 60 30 100 25`}
                    fill="#264934"
                  />
                </g>
              ))}
            </g>
          ))}
          <path d="M270 820l80-130h80l100 130" fill="#788071" />
          <path d="M342 655h87l-8-35h-63zM360 592h65l-9-25h-44z" fill="#6c7768" />
        </>
      )
    case 14:
      return (
        <>
          <AutumnScenery scene={14} />
          <path d="M0 650q400-100 800 0v170H0z" fill="#413d2b" />
          <Bench />
          {Array.from({ length: 32 }, (_, i) => (
            <ellipse
              key={i}
              cx={(i * 173) % 800}
              cy={670 + ((i * 43) % 150)}
              rx="8"
              ry="3"
              fill={i % 2 ? '#96704a' : '#765039'}
            />
          ))}
        </>
      )
    case 15:
      return (
        <>
          <circle cx="540" cy="180" r="64" fill="#d9d8ba" />
          <path d="M0 400h800v420H0z" fill="#29484f" />
          <path d="M520 420l-90 290h220l-90-290" fill="#b7c0a3" opacity=".17" />
          {[450, 500, 560, 630].map((y) => (
            <path
              key={y}
              d={`M0 ${y}q180-24 360 0t440 0`}
              stroke="#9aafa3"
              strokeWidth="3"
              fill="none"
              opacity=".35"
            />
          ))}
          <path d="M0 740q350-90 800-35v115H0z" fill="#7c7358" />
          <path
            d="M0 730q400-55 800-40"
            stroke="#b4b39a"
            opacity=".55"
            strokeWidth="9"
            fill="none"
          />
        </>
      )
    case 16:
      return (
        <>
          {hills}
          <path d="M0 460h800v360H0z" fill="#3b5553" />
          <path d="M320 820l60-300h70l70 300" fill="#665d46" />
          {[570, 620, 690, 770].map((y) => (
            <path key={y} d={`M335 ${y}h165`} stroke="#373e32" strokeWidth="5" />
          ))}
          <path d="M360 550v-60m110 60v-60" stroke="#756b50" strokeWidth="12" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse
              key={i}
              cx={80 + ((i * 139) % 700)}
              cy={540 + ((i * 61) % 250)}
              rx="31"
              ry="6"
              fill="none"
              stroke="#9aafa1"
              opacity=".35"
            />
          ))}
        </>
      )
    case 17:
      return (
        <>
          {trees()}
          <path d="M290 420q360 120 80 400h270q200-260-230-400" fill="#416965" />
          <path
            d="M340 470q280 100 130 340"
            stroke="#9db9aa"
            opacity=".4"
            strokeWidth="8"
            fill="none"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M${i % 2 ? 490 + i * 30 : 40 + i * 27} ${490 + i * 48}l65-45 75 25 10 60-130 10z`}
              fill={i % 2 ? '#485b4d' : '#364d42'}
            />
          ))}
        </>
      )
    case 18:
      return (
        <>
          <path d="M0 400h800v420H0z" fill="#2c474a" />
          <path d="M590 390l20-230h70l20 230" fill="#a5a189" />
          <path d="M600 160h90l-10-35h-70z" fill="#5b5d4c" />
          <path d="M620 135v-50h50v50" fill="#e4c27d" />
          <path d="M630 90L100 260l520-120" fill="#dfcf93" opacity=".09" />
          {[120, 330, 500].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} ${550 + i * 65}h170l-35 55h-105z`}
                fill={i % 2 ? '#625f49' : '#80745a'}
              />
              <path d={`M${x + 80} ${550 + i * 65}v-155`} stroke="#adb398" strokeWidth="4" />
              <path d={`M${x + 84} ${400 + i * 65}l65 130h-65z`} fill="#87988a" opacity=".6" />
            </g>
          ))}
          <path d="M0 770l800-55v105H0z" fill="#514d3c" />
        </>
      )
    case 19:
      return (
        <>
          <path d="M0 0h800v820H0z" fill="#2b463f" />
          <path d="M0 0h330l-30 340-100 270H0zM530 0h270v650H650l-130-260z" fill="#35483c" />
          <path d="M330 0h200l-15 520H315z" fill="#76978e" />
          <path
            d="M360 0l-20 500m48-500-8 520M490 0l-5 480"
            stroke="#b4c8b8"
            opacity=".4"
            strokeWidth="8"
          />
          <ellipse cx="415" cy="590" rx="260" ry="90" fill="#42695d" />
          <ellipse cx="415" cy="590" rx="150" ry="28" fill="none" stroke="#9aafa0" opacity=".35" />
          <path d="M40 700h260l-25 120H0z" fill="#526148" />
          <Bench x={50} y={595} />
        </>
      )
    case 20:
      return (
        <>
          <AutumnScenery scene={20} />
          <path d="M0 0h800v820H0zM80 155h640v400H80z" fill="#393e33" fillRule="evenodd" />
          <path d="M400 160v390" stroke="#777c67" strokeWidth="12" />
          <path d="M0 650q80-80 170 0v170H0zM630 650q80-80 170 0v170H630z" fill="#665e47" />
          <path d="M180 655h440l-45 80H225z" fill="#8f7753" />
          <path d="M310 735v85m180-85v85" stroke="#5b5440" strokeWidth="15" />
          <Mug x={405} y={625} />
        </>
      )
    case 21:
      return (
        <>
          {hills}
          <path d="M0 650q400-130 800 0v170H0z" fill="#293a30" />
          <path d="M200 710l220-340 230 340z" fill="#897447" />
          <path d="M420 370l125 340H310z" fill="#d0ac69" />
          <path d="M420 450l-80 260h170z" fill="#725d39" />
          <path d="M160 730l260-360 280 360" fill="none" stroke="#b1a17b" strokeWidth="5" />
          <path d="M620 760l70-90m-80 10 85 65" stroke="#6c5136" strokeWidth="15" />
          <path d="M625 715q-15-50 35-85-5 45 20 55 35-20 12-50 65 45 15 80" fill="#ce9a59" />
        </>
      )
    case 22:
      return (
        <>
          <path d="M0 520q400-70 800 0v300H0z" fill="#253d33" />
          <AutumnScenery scene={22} />
        </>
      )
    case 23:
      return (
        <>
          {hills}
          <SnowLodgeExterior />
        </>
      )
    case 24:
      return (
        <>
          {hills}
          {Array.from({ length: 45 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 173) % 800}
              cy={30 + ((i * 67) % 350)}
              r={i % 5 === 0 ? 2.5 : 1.2}
              fill="#d2d4b6"
              opacity=".65"
            />
          ))}
          <path d="M0 690q400-110 800 0v130H0z" fill="#252f2b" />
          <path
            d="M60 680h680M100 680v100M300 680v100M500 680v100M700 680v100"
            stroke="#607066"
            strokeWidth="8"
          />
        </>
      )
    case 25:
      return (
        <>
          <AutumnScenery scene={25} />
          <path d="M0 0h800v90H0z" fill="#28332a" />
          <path d="M0 85q400 95 800 0l-40 50q-360 90-720 0z" fill="#4d5545" />
          <path d="M75 115v570M720 115v570" stroke="#6e5b3e" strokeWidth="25" />
          <path d="M0 650h800v170H0z" fill="#63513b" />
          {[700, 760].map((y) => (
            <path key={y} d={`M0 ${y}h800`} stroke="#393c2d" strokeWidth="4" />
          ))}
          <path d="M0 820l240-170m160 170V650m400 170L560 650" stroke="#393c2d" strokeWidth="4" />
          <Mug x={430} y={680} />
          <path d="M560 650h100v22H560z" fill="#b2a78a" />
        </>
      )
    case 26:
      return (
        <>
          <path d="M0 0h800v820H0z" fill="#494b3b" />
          <AutumnScenery scene={26}>
            <circle cx="550" cy="240" r="45" fill="#b6c1a6" />
          </AutumnScenery>
          <path d="M0 650h800v170H0z" fill="#565b47" />
          <path
            d="M400 650v170M100 650l-90 170m690-170 90 170M0 730h800"
            stroke="#777965"
            strokeWidth="3"
          />
          <ellipse cx="400" cy="700" rx="130" ry="42" fill="#263d35" />
          <path
            d="M390 680v-230m0 70q-120-100-150-20m150 30q100-130 170-80"
            stroke={getAutumnSpace(26)!.palette.bark}
            strokeWidth="12"
            fill="none"
          />
        </>
      )
    case 27:
      return (
        <>
          {trees('#27453a')}
          <path d="M80 740h640" stroke="#9b9a78" strokeWidth="16" />
          {[130, 260, 530, 660].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 35} ${680 - (i % 2) * 90}h70l-10 80h-50z`} fill="#8a6b4b" />
              <path d={`M${x} ${680 - (i % 2) * 90}v-190`} stroke="#62845b" strokeWidth="7" />
              {[0, 1, 2].map((j) => (
                <ellipse
                  key={j}
                  cx={x + (j % 2 ? 25 : -25)}
                  cy={530 - (i % 2) * 90 + j * 50}
                  rx="40"
                  ry="18"
                  transform={`rotate(${j % 2 ? -30 : 30} ${x} ${530 - (i % 2) * 90 + j * 50})`}
                  fill="#486d4e"
                />
              ))}
            </g>
          ))}
          <path d="M350 820V620h100v200" fill="#69705a" />
        </>
      )
    case 28:
      return (
        <>
          <path d="M0 300q400-100 800 0v520H0z" fill="#284b45" />
          <path
            d="M0 370q180-120 340-70M580 320q160-80 220 20"
            stroke="#3c5945"
            strokeWidth="80"
            fill="none"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i} transform={`translate(${80 + ((i * 157) % 660)} ${430 + ((i * 91) % 330)})`}>
              <ellipse rx="56" ry="20" fill={i % 2 ? '#4a6c4c' : '#385f48'} />
              <path d="M0 0l30-15" stroke="#213d32" strokeWidth="4" />
              {i % 3 === 0 && (
                <g transform="translate(0 -23)" fill="#b4968a">
                  <path d="M0 0q-40-10-30-35Q0-35 0 0M0 0q40-10 30-35Q0-35 0 0" />
                  <path d="M0 0q-23-35 0-55 23 25 0 55" fill="#c9ae99" />
                </g>
              )}
            </g>
          ))}
        </>
      )
    default:
      return (
        <>
          <path d="M0 650q400-100 800 0v170H0z" fill="#9aa99b" />
          <path
            d="M190 700V190m0 180L75 260m115 220 150-170M630 680V140m0 160-140-100m140 210 100-160"
            stroke="#53604f"
            strokeWidth="18"
          />
          <path
            d="M75 253l115 109 150-62m150-110 140 102 100-52"
            fill="none"
            stroke="#b5c0aa"
            strokeWidth="12"
          />
          <path d="M330 690h140v100H330zM310 680l90-70 90 70z" fill="#53604c" />
          <path d="M350 710h100v55H350z" fill="#dfbd7d" />
          <path d="M310 680l90-70 90 70" stroke="#c5c9b2" strokeWidth="13" />
          {Array.from({ length: 42 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 137) % 800}
              cy={(i * 79) % 780}
              r={2 + (i % 3)}
              fill="#d1d6c2"
              opacity=".6"
            />
          ))}
        </>
      )
  }
}
function CafeArt({ backgroundId, thumbnail = false, paused = false, artOnly = false }: CafeProps) {
  const background = getBackground(backgroundId)
  const autumn = getAutumnSpace(background.scene)
  const uid = useId().replace(/:/g, '')
  if (background.scene === 35 || background.scene === 36)
    return (
      <SpecialCafeScenes
        background={background}
        thumbnail={thumbnail}
        paused={paused}
        artOnly={artOnly}
      />
    )
  if (background.scene === 0)
    return (
      <OriginalCafe
        background={background}
        thumbnail={thumbnail}
        paused={paused}
        artOnly={artOnly}
      />
    )

  return (
    <div
      className={`cafe background-scene${thumbnail ? ' scene-thumbnail' : ''}`}
      role="img"
      aria-label={background.description}
      data-presence={background.companions ? 'shared' : 'solo'}
      data-testid={thumbnail || artOnly ? undefined : 'cafe-scene'}
      data-paused={autumn ? paused : undefined}
      data-static={autumn ? thumbnail : undefined}
    >
      <svg viewBox="0 0 800 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-sky`} x2="0" y2="1">
            <stop stopColor={autumn?.palette.sky ?? '#10242e'} />
            <stop offset="1" stopColor={autumn?.palette.horizon ?? '#536455'} />
          </linearGradient>
          <radialGradient id={`${uid}-light`}>
            <stop stopColor="#e0b56c" stopOpacity=".14" />
            <stop offset="1" stopColor="#e0b56c" stopOpacity="0" />
          </radialGradient>
          <pattern
            id={`${uid}-rain`}
            width="73"
            height="130"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(12)"
          >
            <path d="M12 0v45m30 15v65m20-90v24" stroke="#bfd2c8" strokeWidth="1.3" opacity=".27" />
          </pattern>
        </defs>
        <Rear>
          <path d="M0 0h800v820H0z" fill={`url(#${uid}-sky)`} />
          <SceneArt n={background.scene} />
        </Rear>
        <Foreground>
          <SceneExteriorProps scene={background.scene} />
          {autumn && <AutumnFallingLeaves scene={background.scene} />}
          <SceneOutdoorLife background={background} />
        </Foreground>
        <CozyRoom background={background} />
        <Foreground>
          {background.scene >= 30 && background.scene !== 30 && (
            <SongInspiredFurnishings scene={background.scene} />
          )}
          <ScenePets background={background} />
          <ellipse cx="440" cy="500" rx="410" ry="390" fill={`url(#${uid}-light)`} />

          <path d="M0 0h800v820H0z" fill="#07100e" opacity=".12" />
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

function SceneExteriorProps({ scene }: { scene: number }) {
  const mode = useSceneLayer()
  const id = useId().replace(/:/g, '')
  if (mode !== 'foreground' || ![1, 3, 4, 12, 31].includes(scene)) return null
  return (
    <g data-scene-prop="exterior-cup">
      <defs>
        <clipPath id={`${id}-legacy`}>
          <path d={getSceneArchitecture(scene).opening} />
        </clipPath>
        <mask id={`${id}-frames`}>
          <rect width="800" height="580" fill="white" />
          <path
            d={getSceneArchitecture(scene).frames}
            fill="none"
            stroke="black"
            strokeWidth={getSceneArchitecture(scene).frameWidth}
          />
          <path
            d={getSceneArchitecture(scene).opening}
            fill="none"
            stroke="black"
            strokeWidth="25"
          />
        </mask>
      </defs>
      <g clipPath={`url(#${id}-legacy)`} mask={`url(#${id}-frames)`}>
        {[1, 4].includes(scene) ? (
          <Mug x={scene === 1 ? 145 : 270} y={560} />
        ) : (
          <LegacyOutdoorFixtures scene={scene} />
        )}
      </g>
    </g>
  )
}
type CafeProps = {
  backgroundId?: string
  thumbnail?: boolean
  paused?: boolean
  artOnly?: boolean
  coffeeCount?: number
  layer?: SceneLayerMode
}
export default function Cafe({ layer = 'all', ...props }: CafeProps) {
  const premium = getPremiumSpace(props.backgroundId ?? '')
  if (premium)
    return (
      <div
        className={`cafe background-scene${props.thumbnail ? ' scene-thumbnail' : ''}`}
        role="img"
        aria-label={premium.description}
        data-paused={props.paused}
        data-testid={props.thumbnail || props.artOnly ? undefined : 'cafe-scene'}
      >
        <PremiumScene
          spaceId={premium.id}
          layer={layer}
          coffeeCount={props.coffeeCount}
          paused={props.paused}
          static={props.thumbnail}
        />
        {!props.thumbnail && !props.artOnly && <SceneCaption name={premium.name} />}
      </div>
    )
  return (
    <SceneLayerContext.Provider value={layer}>
      <CafeArt {...props} />
    </SceneLayerContext.Provider>
  )
}
