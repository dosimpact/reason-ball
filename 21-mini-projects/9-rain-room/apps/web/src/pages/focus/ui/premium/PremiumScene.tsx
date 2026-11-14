import { useId } from 'react'
import { premiumGeometry } from './premiumGeometry'
import { Cup, Book, Shelf, Plant, Pet, Frame } from './PremiumObjects'
import { PremiumAtmosphereDrawing } from './PremiumAtmosphere'
import './premium.css'
import CinemaFilm from './CinemaFilm'
import { PremiumInteriorProvider, PREMIUM_INTERIORS, PremiumMaterials } from './PremiumInterior'
import { ThemeTable as Table, ThemeLamp as Lamp } from './PremiumFixtures'
import Reader from './PremiumCharacter'
import PremiumSignatureDetails from './PremiumSignatureDetails'
import PremiumArchitecture from './PremiumArchitecture'
import { SleepingDragon, LegendaryForeground, ThemeMachine } from './PremiumHeroes'
import AutumnScenery, { AutumnFallingLeaves } from '../AutumnScenery'
const trees = (color = '#264b3e') =>
  Array.from({ length: 8 }, (_, i) => (
    <g key={i}>
      <path d={`M${i * 120 - 20} ${150 + (i % 3) * 45}v480`} stroke="#405842" strokeWidth="13" />
      <path
        d={`M${i * 120 - 20} ${100 + (i % 3) * 45}l-75 170h35l-70 120h220l-70-120h35z`}
        fill={color}
      />
    </g>
  ))
const hills = (
  <>
    <path d="M0 430 175 160 350 380 520 130 800 420V820H0Z" fill="#2e4948" />
    <path d="M0 520 240 330 420 500 650 310 800 450V820H0Z" fill="#24433d" />
  </>
)
const city = (
  <g>
    {Array.from({ length: 11 }, (_, i) => (
      <g key={i}>
        <path
          d={`M${i * 80 - 20} ${210 + (i % 4) * 38}h66v420h-66z`}
          fill={i % 2 ? '#28434b' : '#20373f'}
        />
        {[0, 1, 2, 3, 4].map((j) => (
          <path
            key={j}
            d={`M${i * 80 - 4} ${245 + (i % 4) * 38 + j * 50}h7m16 0h7`}
            stroke={i % 3 ? '#998b62' : '#6e9290'}
            strokeWidth="7"
            opacity=".6"
          />
        ))}
      </g>
    ))}
  </g>
)
const stars = (
  <g fill="#c4cfb5" opacity=".65">
    {Array.from({ length: 38 }, (_, i) => (
      <circle
        key={i}
        cx={40 + ((i * 131) % 730)}
        cy={40 + ((i * 67) % 375)}
        r={i % 7 === 0 ? 2.7 : 1.3}
      />
    ))}
  </g>
)
/** Cool lunar stone, kept behind the alchemy room's original hills and window frame. */
function AlchemyMoon() {
  const uid = `alchemy-moon-${useId().replace(/:/g, '')}`
  return (
    <g transform="translate(500 190)" data-premium-detail="alchemy-moon">
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop stopColor="#bfd7d4" stopOpacity=".2" />
          <stop offset=".45" stopColor="#9abec9" stopOpacity=".12" />
          <stop offset=".72" stopColor="#799fac" stopOpacity=".04" />
          <stop offset="1" stopColor="#648897" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-stone`} cx=".28" cy=".24" r=".94">
          <stop stopColor="#d8dfcc" />
          <stop offset=".38" stopColor="#c0cfc1" />
          <stop offset=".72" stopColor="#a3bbb4" />
          <stop offset="1" stopColor="#78979e" />
        </radialGradient>
        <linearGradient id={`${uid}-night`}>
          <stop stopColor="#517480" stopOpacity="0" />
          <stop offset=".42" stopColor="#517480" stopOpacity=".06" />
          <stop offset="1" stopColor="#3d616e" stopOpacity=".45" />
        </linearGradient>
        <radialGradient id={`${uid}-basin`} cx=".65" cy=".7">
          <stop stopColor="#76969b" stopOpacity=".3" />
          <stop offset=".7" stopColor="#839f9f" stopOpacity=".17" />
          <stop offset="1" stopColor="#9bb1aa" stopOpacity=".04" />
        </radialGradient>
        <clipPath id={`${uid}-disk`}>
          <circle r="98" />
        </clipPath>
      </defs>
      <circle r="210" fill={`url(#${uid}-halo)`} opacity=".65" />
      <circle r="144" fill={`url(#${uid}-halo)`} />
      <circle r="112" fill={`url(#${uid}-halo)`} opacity=".8" />
      <circle r="98" fill={`url(#${uid}-stone)`} />
      <g clipPath={`url(#${uid}-disk)`}>
        <path
          d="M-72-39q6-25 28-22t21 18q22-10 29 9T-9-7q-12 18-31 7t-28-10q-21-8-4-29ZM-49 17q19-17 36-8t14 25q20 8 8 27t-36 7q-22 5-28-12t6-39ZM30-63q18-10 30 3t2 29q-20 13-31-2t-1-30Z"
          fill="#79999b"
          opacity=".22"
        />
        <path
          d="M-65-33q17-18 34-4t11 23M-40 24q22-12 36 6M34-53q14-7 22 8"
          fill="none"
          stroke="#a9beb5"
          strokeWidth="3"
          opacity=".25"
        />
        {[
          [-57, -57, 12, 9],
          [-26, -70, 8, 6],
          [4, -43, 17, 14],
          [-44, -13, 9, 8],
          [-76, 7, 7, 11],
          [-22, 28, 21, 18],
          [24, 5, 11, 10],
          [49, 32, 15, 12],
          [64, -17, 8, 11],
          [-46, 61, 9, 7],
          [3, 71, 6, 5],
          [33, 61, 7, 6],
        ].map(([x, y, rx, ry]) => (
          <g key={`${x}-${y}`}>
            <ellipse cx={x} cy={y} rx={rx + 1.5} ry={ry + 1} fill="#d9e1cd" opacity=".12" />
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${uid}-basin)`} />
            <path
              d={`M${x - rx * 0.8} ${y - ry * 0.15}q${rx * 0.8} ${-ry * 1.15} ${rx * 1.6} 0`}
              fill="none"
              stroke="#6c8c94"
              strokeWidth="1.4"
              opacity=".24"
            />
            <path
              d={`M${x - rx * 0.74} ${y + ry * 0.2}q${rx * 0.74} ${ry * 1.08} ${rx * 1.48} 0`}
              fill="none"
              stroke="#e4e8d5"
              strokeWidth="1.3"
              opacity=".52"
            />
          </g>
        ))}
        <path d="M23-103Q-12-57 15-9T7 103h99V-103Z" fill={`url(#${uid}-night)`} />
        <g fill="#e0e5d1" opacity=".33">
          <circle cx="-61" cy="32" r="1.7" />
          <circle cx="-10" cy="-16" r="1.1" />
          <circle cx="-17" cy="57" r="1.3" />
          <circle cx="-43" cy="-77" r="1.1" />
          <circle cx="16" cy="45" r="1.2" />
        </g>
      </g>
      <circle r="97.4" fill="none" stroke="#d2dfd0" strokeWidth="1.2" opacity=".34" />
    </g>
  )
}
function Landscape({ id }: { id: string }) {
  switch (id) {
    case 'premium-christmas-bookcafe':
      return (
        <>
          {trees('#315245')}
          <path d="M0 480q400-70 800 0v340H0" fill="#9baea3" />
          <path d="M255 395 400 265 550 395z" fill="#c5c7ae" />
          <path d="M275 395h250v150H275z" fill="#74634a" />
          <path d="M315 430h65v65h-65m120-65h55v65h-55" fill="#d1ae6c" />
          <g fill="#d6ddcd">
            {Array.from({ length: 32 }, (_, i) => (
              <circle key={i} cx={(i * 137) % 800} cy={(i * 73) % 570} r={2 + (i % 3)} />
            ))}
          </g>
        </>
      )
    case 'premium-halloween-greenhouse':
      return (
        <>
          {trees('#263d39')}
          <circle cx="590" cy="180" r="76" fill="#b5aa79" />
          <path d="M100 530q300-90 600 0v290H100" fill="#344537" />
        </>
      )
    case 'premium-sakura-teahouse':
      return (
        <>
          <path d="M0 410h800v410H0z" fill="#47675a" />
          <path d="M0 470q400-80 800 0" stroke="#7e8c70" strokeWidth="35" fill="none" />
          <path
            d="M70 580 140 125m0 170 180-90m-180 40L10 165M730 580 670 150m0 160-155-95"
            stroke="#6c6250"
            strokeWidth="18"
          />
          {[75, 150, 240, 330, 520, 610, 700].map((x, i) => (
            <g key={x} fill={i % 2 ? '#ad8c8b' : '#c4a5a0'}>
              <ellipse cx={x} cy={160 + (i % 3) * 40} rx="70" ry="44" />
              <ellipse cx={x + 20} cy={200 + (i % 3) * 25} rx="55" ry="35" />
            </g>
          ))}
          <path d="M270 505h250m-225 10v40m200-40v40" stroke="#8c7757" strokeWidth="10" />
        </>
      )
    case 'premium-autumn-lake':
      return <AutumnScenery scene={id} opening={premiumGeometry(id).opening} />
    case 'premium-newyear-attic':
      return (
        <>
          {city}
          {stars}
          <g fill="none" stroke="#bca879" strokeWidth="3" opacity=".7">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <path
                key={i}
                d={`M${525 + Math.cos((i * Math.PI) / 4) * 30} ${190 + Math.sin((i * Math.PI) / 4) * 30}l${Math.cos((i * Math.PI) / 4) * 35} ${Math.sin((i * Math.PI) / 4) * 35}`}
              />
            ))}
          </g>
          <path d="M100 490h600v330H100" fill="#354a45" />
        </>
      )
    case 'premium-orient-express':
      return (
        <>
          {hills}
          <path d="M0 460q400-100 800-20v380H0" fill="#29453b" />
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={i}
              d={`M${i * 125} 330v230m-32-160 32-65 32 65`}
              stroke="#314f40"
              strokeWidth="16"
              fill="none"
            />
          ))}
          <path d="M0 520h800" stroke="#9a9975" strokeWidth="3" opacity=".5" />
        </>
      )
    case 'premium-treetop-house':
      return (
        <>
          {trees('#35583f')}
          <path d="M0 0h95l50 600H0m655 0 60-600h85v600" fill="#384c31" />
          <path
            d="M170 510q220 60 470-20m-470-55q230 75 470-10M190 440v75m75-60v75m80-60v70m80-70v70m85-75v65m80-75v65"
            stroke="#958561"
            strokeWidth="7"
            fill="none"
          />
          <path d="M150 580q300-65 600 0v240H150" fill="#35513b" />
        </>
      )
    case 'premium-storm-lighthouse':
      return (
        <>
          <path d="M0 310h800v510H0" fill="#355360" />
          {[380, 455, 530].map((y) => (
            <path
              key={y}
              d={`M0 ${y}q70-70 140 0t140 0 140 0 140 0 240 0`}
              fill="none"
              stroke="#859e99"
              strokeWidth="8"
              opacity=".55"
            />
          ))}
          <path d="M50 560 150 445 250 510 370 430 530 560z" fill="#3b4c49" />
          <g data-premium-hero="fixed-coastal-lighthouse">
            <path d="M520 476 549 430 603 410 664 448 706 483Z" fill="#465b59" />
            <path d="M570 440 582 234h36l22 206Z" fill="#a0a696" stroke="#6e8582" strokeWidth="3" />
            <path d="M579 294h46l3 28h-51zM575 370h59l3 27h-64z" fill="#718b88" />
            <path d="M592 402h17v38h-17zM594 255h10v20h-10z" fill="#405f65" />
            <path d="M574 180h52v50h-52z" fill="#4b686c" stroke="#b4b994" strokeWidth="3" />
            <path d="M579 186h42v35h-42z" fill="#d7d2a3" opacity=".35" />
            <path d="m568 180 32-24 32 24z" fill="#758b85" stroke="#b4b994" strokeWidth="3" />
            <path
              d="M567 230h66m-62-2v11m9-11v11m40-11v11m9-11v11M569 240h63"
              fill="none"
              stroke="#a8b49c"
              strokeWidth="3"
            />
          </g>
        </>
      )
    case 'premium-canal-houseboat':
      return (
        <>
          <path d="M0 0h800v820H0" fill="#36575a" />
          <path d="M0 370h800v450H0" fill="#3c6264" />
          <path d="M0 380V150h180v230m400 0V120h220v260" fill="#64715f" />
          <path
            d="M190 360q210-260 420 0M185 360h430"
            fill="none"
            stroke="#8b9278"
            strokeWidth="32"
          />
          <path d="M200 360q200-190 400 0" fill="none" stroke="#334f4c" strokeWidth="28" />
          {[90, 680, 740].map((x) => (
            <path key={x} d={`M${x} 205h28v53h-28`} fill="#b6a16c" />
          ))}
          <path
            d="M0 460q400-45 800 0m-800 65q400-45 800 0"
            fill="none"
            stroke="#92b1a2"
            strokeWidth="3"
          />
        </>
      )
    case 'premium-cloud-airship':
      return (
        <>
          {stars}
          <circle cx="560" cy="180" r="65" fill="#b8c6b1" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M0 ${350 + i * 85}q60-90 150-30 100-100 200-10 100-80 220 5 100-80 230 0v190H0`}
              fill={['#698483', '#536f73', '#405e65'][i]}
              opacity=".8"
            />
          ))}
          <path
            d="M570 260q60-45 120 0l-10 30h-100zM630 290v35m-20 0h40"
            fill="#b1ab87"
            stroke="#8e987f"
            strokeWidth="3"
          />
        </>
      )
    case 'premium-wizard-library':
      return (
        <>
          {stars}
          <path
            d="M70 570V380l75-65 75 65V270l70-100 70 100v300m100 0V280l75-110 75 110v105l75-70 75 65v190"
            fill="#3b4450"
          />
          <path d="M280 175v-65m245 65v-65" stroke="#a7a687" strokeWidth="5" />
          <circle cx="400" cy="185" r="55" fill="#b9baa3" />
          <path d="M0 550q400-70 800 0v270H0" fill="#343f3f" />
        </>
      )
    case 'premium-dragon-study':
      return (
        <>
          {hills}
          <path d="M0 520q180-120 360 0t440 0v300H0" fill="#424d3b" />
          <path d="M500 380 585 250 640 330 700 220 800 390v430H500" fill="#6b6147" />
          <path
            d="M515 550q40-95 100-5t150-20"
            stroke="#b2935b"
            strokeWidth="12"
            fill="none"
            opacity=".5"
          />
        </>
      )
    case 'premium-mushroom-teahouse':
      return (
        <>
          {trees('#41583e')}
          <path d="M0 510q400-70 800 0v310H0" fill="#58694a" />
          {[150, 340, 620].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 15} ${450 - (i % 2) * 70}h30v100h-30z`} fill="#9eaa83" />
              <path
                d={`M${x - 100} ${450 - (i % 2) * 70}q100-160 200 0z`}
                fill={i % 2 ? '#8b6d56' : '#a17a5c'}
              />
              <g fill="#cfb994">
                {[-50, 0, 50].map((a) => (
                  <circle key={a} cx={x + a} cy={415 - (i % 2) * 70 - Math.abs(a) / 3} r="10" />
                ))}
              </g>
            </g>
          ))}
        </>
      )
    case 'premium-moon-alchemy':
      return (
        <>
          {stars}
          <AlchemyMoon />
          {hills}
          <path d="M0 500q400-30 800 0v320H0" fill="#3e5755" />
        </>
      )
    case 'premium-spirit-tree':
      return (
        <>
          {trees('#345f48')}
          <path
            d="M90 600q45-240 160-500M710 600q-45-240-160-500"
            stroke="#5a6545"
            strokeWidth="45"
            fill="none"
          />
          <path d="M0 530q400-85 800 0v290H0" fill="#3d5a43" />
          {Array.from({ length: 25 }, (_, i) => (
            <circle
              key={i}
              cx={100 + ((i * 137) % 600)}
              cy={140 + ((i * 61) % 360)}
              r={2 + (i % 3)}
              fill="#b8cc8a"
              opacity=".5"
            />
          ))}
        </>
      )
    case 'premium-neon-loft':
      return (
        <>
          {city}
          <path d="M0 510h800v310H0" fill="#304a50" />
          {[125, 340, 610].map((x, i) => (
            <g
              key={x}
              transform={`translate(${x - 25} ${225 + (i % 2) * 95}) skewY(${i === 2 ? 8 : -5})`}
            >
              <path d="M0-45h150v305H0z" fill="#29434b" stroke="#4b6567" strokeWidth="3" />
              {[0, 1, 2].map((r) => (
                <path
                  key={r}
                  d={`M15 ${-24 + r * 110}h22m25 0h22m25 0h22`}
                  stroke="#6a8680"
                  strokeWidth="8"
                  opacity=".6"
                />
              ))}
              <rect x="15" y="22" width="120" height="82" rx="5" fill="#233e44" />
              <path d="M15 40H0m15 48H0m135-48h15m-15 48h15" stroke="#7e9590" strokeWidth="4" />
            </g>
          ))}
          <path d="M160 525v95m215-95v95m270-95v95" stroke="#8ba4a0" strokeWidth="8" opacity=".2" />
        </>
      )
    case 'premium-midnight-jazz':
      return (
        <>
          {city}
          <path d="M0 455h800v365H0" fill="#37444b" />
          <path d="M0 505h800m-800 35h800" stroke="#7b8e84" strokeWidth="3" opacity=".4" />
          <path d="M170 230h90v110h-90m300-80h100v110H470" fill="#b6965d" opacity=".55" />
          <path d="M0 440q400-130 800 0" stroke="#58706a" strokeWidth="12" fill="none" />
        </>
      )
    case 'premium-museum-studio':
      return (
        <>
          {hills}
          <path d="M0 330h800v490H0" fill="#698174" />
          <path d="M0 400q400-90 800 0v420H0" fill="#526b5f" />
          <path
            d="M190 440h420m-365-5v-95m105 95v-95m105 95v-95m105 95v-95"
            stroke="#a8ad94"
            strokeWidth="9"
          />
        </>
      )
    case 'premium-last-bookstore':
      return (
        <>
          {city}
          <path d="M0 425h800v395H0" fill="#45534b" />
          <path
            d="M0 480h800m-500-5 40 220m150-220-40 220"
            stroke="#7c8268"
            strokeWidth="5"
            opacity=".5"
          />
          <path d="M100 280h130v100H100m450-90h140v100H550" fill="#b09866" opacity=".5" />
        </>
      )
    case 'premium-rooftop-cinema':
      return (
        <>
          {city}
          <path d="M0 500h800v320H0" fill="#364b49" />
          <path
            d="M0 510h800M50 510v70m140-70v70m140-70v70m140-70v70m140-70v70m140-70v70"
            stroke="#8e9c86"
            strokeWidth="7"
          />
        </>
      )
    case 'premium-waterfall-study':
      return (
        <>
          {trees('#355249')}
          <path d="M70 0h240l-25 570H90z" fill="#88a699" />
          <path
            d="M115 0 100 530m80-530-10 540m70-540-10 530"
            stroke="#c1d2bb"
            strokeWidth="8"
            opacity=".4"
          />
          <path d="M480 0h320v610L650 420 560 260z" fill="#40594b" />
          <path d="M0 520q400-80 800 0v300H0" fill="#557d70" />
        </>
      )
    case 'premium-underwater-library':
      return (
        <>
          <path d="M0 0h800v820H0" fill="#254b5c" />
          {[125, 350, 620].map((x) => (
            <path key={x} d={`M${x} 0l-90 600h190z`} fill="#75a7a2" opacity=".12" />
          ))}
          <path d="M0 500q400-110 800 0v320H0" fill="#3e6963" />
          {[160, 580, 680].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} 580q-50-130-10-220m10 120q75-100 45-170`}
                stroke="#638d6e"
                strokeWidth="15"
                fill="none"
              />
              {[0, 1, 2].map((j) => (
                <path
                  key={j}
                  d={`M${x - 10 + j * 10} ${400 + j * 60}q-60-45-35-55 40 5 35 55`}
                  fill="#638d6e"
                />
              ))}
            </g>
          ))}
        </>
      )
    case 'premium-rain-garden-dome':
      return (
        <>
          {trees('#3d6047')}
          <path d="M0 500q400-100 800 0v320H0" fill="#577c5e" />
          <path d="M80 580q70-100 150 0m300 0q100-130 220 0" fill="#527b50" />
          {[160, 240, 560, 650].map((x) => (
            <circle key={x} cx={x} cy="450" r="18" fill="#a99483" />
          ))}
          <path d="M310 570q90-180 180 0" fill="#668a70" />
        </>
      )
    case 'premium-desert-rain':
      return (
        <>
          <path d="M0 350q180-100 370 0t430-20v490H0" fill="#9b8e6d" />
          <path d="M0 490q300-120 800-40v370H0" fill="#7c7957" />
          <path
            d="M145 540q-45-185 0-290m0 30q-100-80-145 0 90-20 145 0m0 0q100-100 165-25-105-25-165 25"
            stroke="#5e6f46"
            strokeWidth="12"
            fill="none"
          />
          <path d="M500 515q65-100 130 0" fill="#537363" />
          <path d="M480 520h170" stroke="#a9b49a" strokeWidth="5" />
        </>
      )
    case 'premium-onsen-veranda':
      return (
        <>
          {trees('#496341')}
          <path d="M0 400h800v420H0" fill="#668274" />
          <ellipse cx="410" cy="520" rx="300" ry="95" fill="#7f9b87" />
          {[180, 550, 650].map((x) => (
            <path
              key={x}
              d={`M${x} 580q-15-75 12-130t-4-85`}
              fill="none"
              stroke="#c7d1b6"
              strokeWidth="8"
              opacity=".22"
            />
          ))}
          <path d="M0 560 110 460 185 515 120 590m680-20-85-120-80 75 35 75" fill="#627565" />
        </>
      )
    case 'premium-observatory':
      return (
        <>
          {stars}
          <circle cx="565" cy="180" r="65" fill="#bec4b0" />
          {hills}
          <path d="M0 540 180 400 330 510 580 380 800 530v290H0" fill="#354c4c" />
        </>
      )
    case 'premium-moon-base':
      return (
        <>
          <path d="M0 0h800v820H0" fill="#183c49" />
          {stars}
          <circle cx="535" cy="235" r="105" fill="#729da1" />
          <path
            d="M480 160q80-20 95 55l-55 25-35-32-32 35-28-35zM575 265l-20 55-45-5 4-43z"
            fill="#a4b79e"
          />
          <path d="M0 470q400-65 800 0v350H0" fill="#778b87" />
          <ellipse cx="200" cy="490" rx="70" ry="18" fill="#536d71" />
          <ellipse cx="650" cy="500" rx="85" ry="23" fill="#536d71" />
        </>
      )
    case 'premium-cloud-post':
      return (
        <>
          {stars}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M0 ${330 + i * 100}q70-100 150-25 90-105 190-10 140-100 250-5 110-95 210-10v200H0`}
              fill={['#7d9790', '#647e7c', '#4e6e70'][i]}
            />
          ))}
          <g transform="translate(580 250)">
            <ellipse cy="-40" rx="55" ry="65" fill="#aa9b73" />
            <path
              d="M-35 7-19 52m54-45L19 52M-23 52h46v28h-46z"
              stroke="#a39b78"
              fill="#7d7154"
              strokeWidth="4"
            />
          </g>
        </>
      )
    case 'premium-personal-roastery':
      return (
        <>
          {city}
          <path d="M0 475h800v345H0" fill="#3c5149" />
          <path d="M0 475h800M45 530h710" stroke="#788778" strokeWidth="4" opacity=".5" />
          <path d="M120 280h160v120H120m280-180h190v130H400" fill="#ab9866" opacity=".3" />
        </>
      )
    case 'premium-memory-house':
      return (
        <>
          {trees('#4f6950')}
          <path d="M0 430q400-100 800 0v390H0" fill="#69816a" />
          <path d="M200 535q180-130 360 0" stroke="#adac84" strokeWidth="18" fill="none" />
          <path
            d="M220 535v-70m70 40v-70m70 35v-70m70 70v-70m70 100v-70"
            stroke="#adac84"
            strokeWidth="6"
          />
        </>
      )
    default:
      return (
        <>
          {hills}
          {trees()}
        </>
      )
  }
}
function Cushion({ x, y, color = '#797257' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy="15" rx="75" ry="20" fill="#423e2d" />
      <path d="M-70-5q70-40 140 0v23q-70 27-140 0z" fill={color} />
      <path d="M-45 0q45-15 90 0" stroke="#b7a47a" strokeWidth="2" fill="none" opacity=".4" />
    </g>
  )
}
function Bottles({
  x,
  y,
  count = 4,
  scale = 1,
}: {
  x: number
  y: number
  count?: number
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: count }, (_, i) => i).map((i) => (
        <g key={i} transform={`translate(${i * 55} 0) scale(1 ${i % 2 ? 0.85 : 1})`}>
          <path
            d="M-7-70h14v24q21 9 20 38v8h-54v-8q-1-29 20-38z"
            fill={['#718f79', '#9b916e', '#6d8d91', '#a18c7a'][i]}
          />
          <path d="M-23-16h46v12h-46z" fill="#bdb48d" opacity=".4" />
          <path d="M-10-73h20v8h-20z" fill="#b2a07c" />
        </g>
      ))}
    </g>
  )
}
function Fireplace() {
  return (
    <g>
      <path d="M250 480h300v180H250z" fill="#7e6d51" />
      <path d="M275 650V550q125-140 250 0v100" fill="#27372b" />
      <path
        d="M320 640q-35-55 25-105 0 40 30 52 30-80 60-105-17 64 25 94 20-40 31-55 42 82 9 119"
        fill="#c59c5b"
      />
      <path d="M245 665h310" stroke="#b39b6b" strokeWidth="16" />
    </g>
  )
}
function OutsideLife({ id, clip }: { id: string; clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} data-premium-layer="living-landscape">
      {id === 'premium-underwater-library' &&
        [180, 370, 580].map((x, i) => (
          <g key={x} transform={`translate(${x} ${230 + (i % 2) * 85})`}>
            <g className="premium-fish" style={{ animationDelay: `-${i * 3}s` }}>
              <path
                d="M-32 0q30-28 60 0-30 28-60 0l-22-19v38z"
                fill={i % 2 ? '#bca977' : '#8cafb1'}
              />
              <circle cx="17" cy="-2" r="2.5" fill="#274551" />
            </g>
          </g>
        ))}
      {id === 'premium-neon-loft' &&
        [125, 340, 610].map((x, i) => (
          <g
            key={x}
            className="premium-neon"
            style={{ animationDelay: `-${i * 3}s` }}
            transform={`translate(${x - 25} ${225 + (i % 2) * 95}) skewY(${i === 2 ? 8 : -5})`}
          >
            <rect
              x="19"
              y="27"
              width="112"
              height="72"
              rx="5"
              fill="none"
              stroke={i % 2 ? '#cd9aa7' : '#8cbdb2'}
              strokeWidth="13"
              opacity=".12"
            />
            <rect
              x="19"
              y="27"
              width="112"
              height="72"
              rx="5"
              fill="none"
              stroke={i % 2 ? '#cd9aa7' : '#8cbdb2'}
              strokeWidth="3"
            />
            <text
              x="75"
              y="72"
              textAnchor="middle"
              fill={i % 2 ? '#d9abb4' : '#a8cfc1'}
              fontFamily="sans-serif"
              fontSize="24"
              letterSpacing="3"
            >
              {['CAFE', 'JAZZ', '24H'][i]}
            </text>
          </g>
        ))}
      {id === 'premium-halloween-greenhouse' && (
        <path
          className="premium-bat"
          d="M550 260q20-26 40 0-16-3-20 8-4-11-20-8m-300 10q20-26 40 0-16-3-20 8-4-11-20-8"
          fill="#142b2c"
        />
      )}
    </g>
  )
}
/** Slender cases fit the solid storefront returns; low cases sit below the glazing. */
function BookstoreWallCases() {
  return (
    <g data-premium-object="bookstore-wall-cases">
      {[6, 756].map((x) => (
        <g key={x} transform={`translate(${x} 112)`}>
          <path d="M0 0h38v562H0z" fill="#3e3b2d" stroke="#897552" strokeWidth="2" />
          <path d="M0 0h38v9H0zM0 550h38v12H0z" fill="#9b8158" />
          {Array.from({ length: 6 }, (_, row) => (
            <g key={row}>
              {[0, 1, 2].map((book) => (
                <path
                  key={book}
                  d={`M${5 + book * 10} ${20 + row * 86 + (book % 2) * 6}h8v${59 - (book % 2) * 6}h-8z`}
                  fill={['#9a8762', '#617267', '#8b6652'][(row + book) % 3]}
                />
              ))}
              <path d={`M2 ${82 + row * 86}h34`} stroke="#a58c62" strokeWidth="5" />
            </g>
          ))}
          <path d="M5 562v18h8v-18m12 0v18h8v-18" fill="#655a44" />
        </g>
      ))}
      {[72, 526].map((x) => (
        <g key={x} transform={`translate(${x} 570)`}>
          <path d="M0 0h202v66H0z" fill="#464331" stroke="#917c57" strokeWidth="4" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M${9 + i * 15.5} ${12 + (i % 3) * 3}h11v${42 - (i % 3) * 3}h-11z`}
              fill={['#8e7d58', '#6b806b', '#a18a62', '#886751'][i % 4]}
            />
          ))}
          <path d="M0 59h202v9H0zM10 68v13h12V68m158 0v13h12V68" fill="#7b684c" />
        </g>
      ))}
    </g>
  )
}
/** Water contact remains at the foreground bath; each translucent curl has its own phase. */
function OnsenBathSteam() {
  const uid = `bath-steam-${useId().replace(/:/g, '')}`
  const origins = [
    [435, 716, 0.86, 0.82],
    [485, 708, 1.08, 1.06],
    [535, 721, 1.18, 0.94],
    [590, 712, 0.94, 1.13],
    [640, 728, 1.12, 0.88],
    [685, 730, 0.8, 0.98],
  ]
  return (
    <g data-premium-object="foreground-onsen-steam">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e5e9d4" stopOpacity="0" />
          <stop offset=".28" stopColor="#e5e9d4" stopOpacity=".12" />
          <stop offset=".7" stopColor="#d9e1c9" stopOpacity=".25" />
          <stop offset="1" stopColor="#d9e1c9" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-surface`}>
          <stop stopColor="#dce5cd" stopOpacity=".22" />
          <stop offset="1" stopColor="#dce5cd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="555" cy="709" rx="152" ry="28" fill={`url(#${uid}-surface)`} />
      {origins.map(([x, y, sx, sy], i) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
          <g
            className="premium-onsen-plume"
            style={{
              animationDuration: `${7.6 + i * 0.55}s`,
              animationDelay: `${-1.4 - i * 1.37}s`,
            }}
          >
            <path
              d="M-22 0C-48-24-4-44-23-69C-45-98-19-118-8-145C-8-110 17-104 9-79C-3-50 39-40 24-12L17 0Z"
              fill={`url(#${uid})`}
            />
          </g>
          <g
            className="premium-onsen-wisp"
            style={{
              animationDuration: `${6.4 + i * 0.6}s`,
              animationDelay: `${-2.3 - i * 1.12}s`,
            }}
            fill="none"
            stroke="#e2e8d0"
            strokeLinecap="round"
          >
            <path
              d={
                i % 2
                  ? 'M0-7C20-28-16-50 2-72S16-102-3-125'
                  : 'M0-7C-24-30 17-48-1-72S-14-107 5-126'
              }
              strokeWidth="19"
              opacity=".045"
            />
            <path
              d={
                i % 2
                  ? 'M0-7C20-28-16-50 2-72S16-102-3-125'
                  : 'M0-7C-24-30 17-48-1-72S-14-107 5-126'
              }
              strokeWidth="3.5"
              opacity=".19"
            />
          </g>
        </g>
      ))}
    </g>
  )
}
function Interior({ id, coffeeCount = 0 }: { id: string; coffeeCount?: number }) {
  const collection =
    coffeeCount >= 25 ? 6 : coffeeCount >= 10 ? 5 : coffeeCount >= 5 ? 4 : coffeeCount >= 1 ? 2 : 1
  switch (id) {
    case 'premium-christmas-bookcafe':
      return (
        <>
          <Shelf x={15} y={210} rows={4} width={115} />
          <Shelf x={670} y={220} rows={3} width={115} />
          <path d="M600 650V365" stroke="#6f6445" strokeWidth="13" />
          <path d="M600 290 525 450h35l-65 110h210l-65-110h35z" fill="#466147" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={550 + (i % 3) * 48}
              cy={445 + Math.floor(i / 3) * 65}
              r="9"
              fill={i % 2 ? '#ba9c64' : '#a17768'}
            />
          ))}
          <path d="m600 270 7 14 16 3-12 12 3 16-14-8-14 8 3-16-12-12 16-3z" fill="#d6bb76" />
          <Reader
            castId="christmas-bookcafe-resident"
            view="front"
            haircut="bob"
            hair="#554136"
            x={270}
            y={610}
            pose="reading"
            color="#89675e"
          />
          <Table x={350} y={650} width={410} />
          <Cup x={465} y={622} />
          <Book x={270} y={623} />
          <Pet x={635} y={745} kind="cat" color="#c2ad89" />
          <path d="M90 95q310-60 620 0" fill="none" stroke="#59704d" strokeWidth="15" />
        </>
      )
    case 'premium-halloween-greenhouse':
      return (
        <>
          <Table x={340} y={665} width={430} kind="root" />
          <Reader
            castId="halloween-greenhouse-resident"
            view="profile"
            haircut="bun"
            hair="#39382e"
            x={290}
            y={625}
            pose="writing"
            color="#716878"
          />
          <Book x={270} y={641} />
          <Bottles x={420} y={648} />
          <Plant x={715} y={705} kind="hanging" scale={0.85} />
          {[170, 620].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 725v-30`} stroke="#7f8050" strokeWidth="8" />
              <ellipse cx={x} cy="735" rx={i ? 55 : 40} ry="35" fill={i ? '#a9824b' : '#9f7a50'} />
              <path
                d={`M${x - 20} 724l10-9 10 9m8 0 10-9 10 9m-32 18q15 12 30 0`}
                fill="none"
                stroke="#5c5638"
                strokeWidth="5"
              />
            </g>
          ))}
          <Pet x={590} y={740} color="#4f5347" />
        </>
      )
    case 'premium-sakura-teahouse':
      return (
        <>
          <path d="M80 590h640v185H80z" fill="#8d805c" />
          <path d="M80 650h640M250 590v185M550 590v185" stroke="#5e6045" strokeWidth="5" />
          <Cushion x={180} y={715} color="#8c7c74" />
          <Cushion x={620} y={715} color="#74816b" />
          <Reader castId="sakura-teahouse-resident" x={555} y={625} pose="coffee" view="profile" />
          <Table x={400} y={685} width={330} kind="low" />
          <Cup x={325} y={656} scale={0.8} />
          <Cup x={465} y={656} scale={0.8} />
          <path d="M370 630q20-25 50 0v30h-50z" fill="#a99b76" />
          <path
            d="M415 635q30-25 40 0l-32 17m-53-15q-35-20-30 10l30 5"
            fill="none"
            stroke="#a99b76"
            strokeWidth="7"
          />
          <Plant x={75} y={665} kind="bonsai" scale={0.75} />
          <Pet x={690} y={755} kind="rabbit" color="#c6c0aa" scale={0.8} />
        </>
      )
    case 'premium-autumn-lake':
      return (
        <>
          <Reader
            castId="autumn-lake-resident"
            view="profile"
            haircut="curly"
            hair="#7d6c51"
            x={600}
            y={625}
            pose="coffee"
            color="#8f7657"
          />
          <Table x={320} y={685} width={330} kind="round" />
          <Book x={290} y={665} />
          <Cup x={430} y={650} />
          <Plant x={75} y={700} kind="flower" />
          <Pet x={115} y={755} color="#b8a27a" />
          <path d="M490 690h220v33H490z" fill="#605c47" />
          <path d="M515 723v97m170-97v97" stroke="#4e503c" strokeWidth="13" />
        </>
      )
    case 'premium-newyear-attic':
      return (
        <>
          <path d="M0 0 130 440M800 0 705 440" stroke="#806e50" strokeWidth="28" />
          <Frame x={25} y={310} width={100} height={125}>
            <path
              d="M15 35h70m-70 20h70m-70 20h70M38 25v75m23-75v75"
              stroke="#a6a083"
              strokeWidth="3"
            />
          </Frame>
          <Reader
            castId="newyear-attic-resident"
            view="back"
            haircut="short"
            hair="#595246"
            x={390}
            y={590}
            pose="writing"
            color="#637a70"
          />
          <Table x={400} y={625} width={520} />
          <Cup x={570} y={590} />
          <Shelf x={80} y={485} width={115} rows={2} />
          <Pet x={680} y={730} color="#a7a799" />
        </>
      )
    case 'premium-orient-express':
      return (
        <>
          <path
            d="M15 575q0-70 75-70h100q65 0 65 70v190H15m530 0V575q0-70 65-70h100q75 0 75 70v190"
            fill="#657164"
          />
          <path d="M35 590h200m330 0h200" stroke="#9c9e7e" strokeWidth="4" />
          <Reader
            castId="orient-express-resident"
            view="profile"
            haircut="short"
            x={190}
            y={630}
            pose="coffee"
            color="#8b6c55"
          />
          <Reader
            castId="orient-express-guest"
            variant="passenger"
            view="profile"
            haircut="bob"
            hair="#706453"
            x={600}
            y={630}
            facing={-1}
            pose="reading"
            color="#667981"
          />
          <Table x={400} y={670} width={255} kind="round" />
          <Cup x={400} y={625} />
          <Book x={400} y={669} scale={0.65} />
          <path
            d="M600 730h145v75H600zM625 730v-16h95v16"
            fill="#867255"
            stroke="#b29e73"
            strokeWidth="5"
          />
        </>
      )
    case 'premium-treetop-house':
      return (
        <>
          <path
            d="M10 820q80-80 80-220V160m700 660q-80-80-80-220V160"
            stroke="#5c6041"
            strokeWidth="45"
            fill="none"
          />
          <Reader
            castId="treetop-house-resident"
            view="profile"
            haircut="curly"
            x={300}
            y={620}
            pose="reading"
            color="#7a8363"
          />
          <Table x={340} y={660} width={380} kind="root" />
          <Cup x={480} y={625} />
          <Plant x={675} y={650} kind="hanging" scale={0.9} />
          <Pet x={640} y={755} kind="fox" color="#ad8c61" />
          <path d="M105 580h130v15H105z" fill="#8d7b54" />
          <Pet x={170} y={565} kind="owl" scale={0.65} />
        </>
      )
    case 'premium-storm-lighthouse':
      return (
        <>
          <path d="M0 620h800M0 660h800M0 700h800" stroke="#87907b" strokeWidth="3" opacity=".4" />
          <Table x={370} y={680} width={450} kind="metal" />
          <Reader
            castId="storm-lighthouse-resident"
            view="profile"
            haircut="short"
            hair="#8b8270"
            x={330}
            y={640}
            pose="writing"
            color="#7c7f6a"
          />
          <Book x={330} y={660} />
          <Cup x={520} y={645} />
          <Frame x={14} y={135} width={70} height={80}>
            <path
              d="M10 56 26 20l15 31 15-10m-45 23h45"
              stroke="#b7b590"
              strokeWidth="4"
              fill="none"
            />
          </Frame>
          <path d="M650 580v165m-35 0h70" stroke="#929780" strokeWidth="9" />
          <circle cx="650" cy="550" r="45" fill="#8c9277" />
          <circle cx="650" cy="550" r="32" fill="#456264" />
          <path d="m630 550 20-20 15 35" stroke="#bfc4a1" strokeWidth="4" fill="none" />
          <Pet x={125} y={755} color="#939b8e" />
        </>
      )
    case 'premium-canal-houseboat':
      return (
        <>
          <path d="M20 640h180v130H20m600-130h160v130H620" fill="#6f775a" />
          <Reader
            castId="canal-houseboat-resident"
            x={245}
            y={635}
            pose="reading"
            color="#8b7860"
          />
          <Table x={385} y={675} width={365} />
          <Cup x={455} y={640} />
          <path
            d="M690 575q-55 40-20 90 45 40 70-10 25-40-20-45-40-2-33 35"
            fill="none"
            stroke="#a79b74"
            strokeWidth="12"
          />
          <Plant x={72} y={585} kind="hanging" scale={0.65} />
          <Pet x={660} y={755} color="#79867a" />
        </>
      )
    case 'premium-cloud-airship':
      return (
        <>
          <path d="M90 620q310-90 620 0v110H90z" fill="#7c8e7e" />
          <path d="M120 645q280-65 560 0v45H120z" fill="#405b56" />
          {[220, 400, 580].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={635 - (i % 2) * 18} r="30" fill="#a6b095" />
              <circle cx={x} cy={635 - (i % 2) * 18} r="20" fill="#426768" />
              <path d={`m${x} ${635 - (i % 2) * 18} 10-12`} stroke="#c8cba4" strokeWidth="3" />
            </g>
          ))}
          <Reader
            castId="cloud-airship-resident"
            view="back"
            haircut="short"
            hair="#514d43"
            x={580}
            y={620}
            pose="laptop"
            color="#707f76"
          />
          <path d="M120 560h100v14H120M160 574v150" stroke="#9eaa8e" strokeWidth="8" />
          <Pet x={165} y={545} kind="owl" color="#a49d7e" scale={0.7} />
          <Cup x={280} y={592} />
        </>
      )
    case 'premium-wizard-library':
      return (
        <>
          <Shelf x={8} y={175} rows={5} width={125} />
          <Shelf x={670} y={175} rows={5} width={125} />
          <Table x={400} y={670} width={350} kind="round" />
          <Reader
            castId="wizard-library-resident"
            view="front"
            haircut="bun"
            hair="#514039"
            x={400}
            y={625}
            pose="writing"
            color="#766b85"
          />
          <Book x={400} y={640} />
          <path
            d="M620 655h150v14H620m100 14 45 35m-110-49 90 0"
            fill="#877856"
            stroke="#877856"
            strokeWidth="7"
          />
          <Bottles x={650} y={655} count={2} scale={0.7} />
          <path d="M145 585h100v16H145m50 16v145" stroke="#978662" strokeWidth="10" />
          <Pet x={190} y={570} kind="owl" color="#a99b7c" scale={0.8} />
          <Plant x={740} y={745} kind="leaf" scale={0.7} />
        </>
      )
    case 'premium-dragon-study':
      return (
        <>
          <Frame x={35} y={240} width={100} height={125}>
            <path d="m20 90 30-55 30 55z" fill="#a99d78" />
          </Frame>
          <Reader
            castId="dragon-study-resident"
            view="profile"
            haircut="bun"
            x={255}
            y={640}
            pose="reading"
            color="#8e7a5d"
          />
          <Table x={280} y={680} width={360} kind="root" />
          <Book x={260} y={660} />
          <Cup x={390} y={644} />
          <ellipse cx="600" cy="750" rx="155" ry="40" fill="#727b58" />
          <SleepingDragon />
          <Shelf x={28} y={460} rows={2} width={140} />
        </>
      )
    case 'premium-mushroom-teahouse':
      return (
        <>
          <path d="M340 660q-50 100-5 160h125q45-60-5-160" fill="#9b9671" />
          <path d="M190 660q210-150 420 0v25q-210 35-420 0z" fill="#a48462" />
          <path
            d="M260 642h25m255 0h25m-180-20h35"
            stroke="#d0bd92"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <Cup x={345} y={613} scale={0.9} />
          <Book x={490} y={625} scale={0.7} />
          <Cushion x={140} y={745} color="#919477" />
          <Cushion x={670} y={745} color="#8c745e" />
          <Plant x={90} y={620} kind="fern" scale={0.7} />
          <Pet x={650} y={730} kind="rabbit" color="#c4bda1" scale={0.85} />
        </>
      )
    case 'premium-moon-alchemy':
      return (
        <>
          <Table x={410} y={685} width={550} kind="metal" />
          <Reader
            castId="moon-alchemy-resident"
            x={535}
            y={620}
            pose="writing"
            standing
            view="profile"
          />

          <path d="M115 565h100v14H115m50-14v-90" stroke="#a4aa8c" strokeWidth="7" />
          <path d="M125 475h80l-20 38 20 40h-80l20-40z" fill="#a5ad8b" />
          <path d="m144 486 21 26 21-26m-42 55 21-26 21 26" fill="#c8b887" />
          <Cup x={650} y={650} scale={0.7} />
          <Plant x={735} y={735} kind="leaf" scale={0.6} />
        </>
      )
    case 'premium-spirit-tree':
      return (
        <>
          <path
            d="M0 820q110-80 100-240V110m700 710q-110-80-100-240V110"
            stroke="#536345"
            strokeWidth="60"
            fill="none"
          />
          <path
            d="M55 680q80-90 175 0m370 0q75-90 145 0"
            stroke="#69714d"
            strokeWidth="35"
            fill="none"
          />
          <Table x={350} y={685} width={320} kind="root" />
          <Book x={320} y={665} />
          <Cup x={445} y={648} />
          <Plant x={70} y={660} kind="flower" scale={0.65} />
          <Pet x={610} y={745} kind="fox" color="#b0b493" />
          <path d="M120 450h85v16H120" fill="#8e8962" />
          <Pet x={160} y={440} kind="owl" scale={0.6} />
        </>
      )
    case 'premium-neon-loft':
      return (
        <>
          <path d="M20 630h590v40H20m540 40h225v35H540" fill="#718382" />
          <path d="M70 670v150m480-150v150m180-75v75" stroke="#475e5b" strokeWidth="18" />
          <path d="M105 440h210v145H105z" fill="#1e3c43" stroke="#90aba2" strokeWidth="8" />
          <path d="M125 465h170v95H125z" fill="#3c6668" />
          <path d="M210 585v45m-45 0h90" stroke="#98a18d" strokeWidth="9" />
          <Reader
            castId="neon-loft-resident"
            view="back"
            haircut="ponytail"
            hair="#4f3e3d"
            x={480}
            y={620}
            pose="laptop"
            color="#71748a"
          />
          <Cup x={350} y={595} />
          <Plant x={740} y={750} kind="leaf" scale={1.1} />
          <Pet x={190} y={755} color="#7b8279" />
        </>
      )
    case 'premium-midnight-jazz':
      return (
        <>
          <path
            d="M85 565h410v155H85zM85 540q120-160 410 0v25H85z"
            fill="#34433c"
            stroke="#8b805c"
            strokeWidth="5"
          />
          <path d="M110 600h360v45H110z" fill="#c3b894" />
          {Array.from({ length: 18 }, (_, i) => (
            <path key={i} d={`M${113 + i * 20} 600v44`} stroke="#4e5749" strokeWidth="2" />
          ))}
          {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17].map((i) => (
            <path key={i} d={`M${117 + i * 20} 600v24`} stroke="#283b33" strokeWidth="10" />
          ))}
          <path d="M115 720v100m350-100v100" stroke="#40513f" strokeWidth="18" />
          <path
            d="M630 740v-130m-40 160 40-40 40 40"
            fill="none"
            stroke="#7f896a"
            strokeWidth="8"
          />
          <path
            d="M620 500q-25-55 12-70l25 15-12 27q-40 85-5 110 30 25 37-12"
            fill="none"
            stroke="#b79a5c"
            strokeWidth="18"
          />
          <path d="M665 550q-10 36 30 20" stroke="#b79a5c" strokeWidth="22" fill="none" />
          <Cup x={405} y={493} />
          <Reader castId="midnight-jazz-resident" x={535} y={626} pose="writing" view="profile" />
          <Pet x={650} y={760} color="#6f6f66" />
        </>
      )
    case 'premium-museum-studio':
      return (
        <>
          <Reader
            castId="museum-studio-resident"
            x={330}
            y={615}
            pose="writing"
            view="profile"
            standing
          />
          <path d="M170 410 100 810m70-400 90 400M90 650h170" stroke="#8e8265" strokeWidth="13" />
          <Frame x={88} y={390} width={180} height={210}>
            <path
              d="m20 170 65-100 65 100m-120-70 120 20"
              fill="#6a8778"
              stroke="#b7ad81"
              strokeWidth="4"
            />
          </Frame>
          <path d="M590 590h125v190H590z" fill="#858d79" />
          <path d="M620 590v-95h65v95m-72-95q-20-85 40-90 65 10 40 90" fill="#b0b69b" />
          <path d="M635 453h7m22 0h7m-25 29h17" stroke="#828c73" strokeWidth="3" />
          <Table x={420} y={720} width={250} kind="metal" />
          <Bottles x={340} y={714} />
          <Book x={480} y={700} scale={0.65} />
          <Plant x={45} y={725} kind="leaf" scale={0.7} />
        </>
      )
    case 'premium-last-bookstore':
      return (
        <>
          <BookstoreWallCases />
          <Reader castId="last-bookstore-resident" x={410} y={645} pose="reading" color="#7e8068" />
          <Table x={410} y={690} width={350} />
          <Cup x={520} y={655} />
          <path
            d="M140 660h120v115H140m-5-70h130m-110 75v30m90-30v30"
            fill="#685f47"
            stroke="#9b8c65"
            strokeWidth="7"
          />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M150 ${665 + i * 22}h100v16H150z`}
              fill={['#98845c', '#637d6c', '#9b715a', '#a09374'][i]}
            />
          ))}
          <Pet x={625} y={755} color="#b4a480" />
          <Book x={410} y={665} />
        </>
      )
    case 'premium-rooftop-cinema':
      return (
        <>
          <path
            d="M0 150h800M50 150v-100m170 100v-100m180 100v-100m180 100v-100m170 100v-100"
            stroke="#697763"
            strokeWidth="24"
          />
          <path d="M465 255h270v200H465z" fill="#c2c4a8" stroke="#9aab93" strokeWidth="10" />
          <path d="M465 455h270m-220 0-30 200m200-200 30 200" stroke="#71866f" strokeWidth="9" />
          <CinemaFilm />
          <path d="M130 615 465 265v190L130 650" fill="#dfd6a3" opacity=".12" />
          <path d="M80 600h125v70H80z" fill="#718779" />
          <circle cx="175" cy="636" r="24" fill="#c4c7a3" />
          <path d="M105 670v115m75-115v115" stroke="#70816d" strokeWidth="10" />
          <Cushion x={350} y={740} />
          <Cushion x={535} y={740} />
          <Table x={380} y={690} width={175} kind="low" />
          <Cup x={380} y={657} />
          <Pet x={675} y={760} color="#b6a380" />
        </>
      )
    case 'premium-waterfall-study':
      return (
        <>
          <Reader
            castId="waterfall-study-resident"
            x={520}
            y={635}
            pose="reading"
            color="#708974"
          />
          <Table x={460} y={680} width={420} kind="metal" />
          <Book x={520} y={655} />
          <Cup x={335} y={644} />
          <Plant x={90} y={680} kind="fern" scale={1.2} />
          <Plant x={715} y={665} kind="hanging" scale={0.85} />
          <Pet x={680} y={755} kind="rabbit" color="#b9c3ad" scale={0.75} />
        </>
      )
    case 'premium-underwater-library':
      return (
        <>
          <Shelf x={5} y={285} rows={4} width={135} />
          <Shelf x={660} y={310} rows={3} width={135} />
          <Reader
            castId="underwater-library-resident"
            view="back"
            haircut="bob"
            hair="#605e53"
            x={400}
            y={620}
            pose="reading"
            color="#63878a"
          />
          <Table x={400} y={665} width={400} kind="metal" />
          <Cup x={545} y={632} />
          <Plant x={745} y={750} kind="leaf" scale={0.65} />
          <path d="M135 690h55v65h-55" fill="#71877a" />
          <Pet x={165} y={680} kind="owl" color="#9cae9a" scale={0.6} />
        </>
      )
    case 'premium-rain-garden-dome':
      return (
        <>
          <Reader
            castId="rain-garden-dome-resident"
            x={235}
            y={665}
            pose="writing"
            view="profile"
          />
          <Plant x={105} y={690} kind="fern" scale={1.1} />
          <Plant x={700} y={695} kind="flower" scale={1.1} />
          <Plant x={180} y={420} kind="hanging" scale={0.75} mountY={330} />
          <Plant x={620} y={400} kind="hanging" scale={0.7} mountY={330} />
          <Table x={400} y={680} width={340} kind="round" />
          <Cup x={350} y={636} />
          <Book x={455} y={656} scale={0.65} />
          <Pet x={620} y={755} kind="rabbit" color="#c2bba1" />
          <path d="M360 610v-80h80v80" fill="#93ae96" opacity=".5" />
          <path d="M370 610v-40m15 40v-60m20 60v-40m20 40v-60" stroke="#547c5a" strokeWidth="7" />
        </>
      )
    case 'premium-desert-rain':
      return (
        <>
          <Reader castId="desert-rain-resident" x={550} y={650} pose="writing" view="profile" />
          <path d="M80 650h640v150H80z" fill="#8f7758" />
          <path
            d="M100 670h600v110H100zM120 685h560v80H120z"
            fill="none"
            stroke="#b09c70"
            strokeWidth="4"
          />
          <Cushion x={185} y={720} color="#a08d69" />
          <Cushion x={620} y={720} color="#7d8c71" />
          <Table x={400} y={695} width={285} kind="low" />
          <Cup x={345} y={663} scale={0.75} />
          <Cup x={460} y={663} scale={0.75} />
          <path
            d="M15 595h235v15H15m25 0 35 30m150-30-35 30"
            stroke="#a68f64"
            fill="#a68f64"
            strokeWidth="6"
          />
          <Bottles x={45} y={594} />
          <Plant x={740} y={735} kind="leaf" scale={0.7} />
          <Pet x={105} y={770} color="#c5b490" scale={0.7} />
        </>
      )
    case 'premium-onsen-veranda':
      return (
        <>
          <path d="M0 130h800M65 130v465M735 130v465" stroke="#8b8060" strokeWidth="27" />
          <path d="M0 580h800v240H0z" fill="#7d7051" />
          <path d="M0 630h800m-800 65h800m-800 65h800" stroke="#5b6248" strokeWidth="4" />
          <ellipse
            cx="550"
            cy="740"
            rx="220"
            ry="100"
            fill="#6a7561"
            stroke="#a4a68a"
            strokeWidth="25"
          />
          <ellipse cx="550" cy="727" rx="190" ry="68" fill="#91aa91" />
          <OnsenBathSteam />
          <Table x={160} y={675} width={170} kind="low" />
          <Cup x={165} y={642} />
          <path d="M80 740h170v30H80zM95 770v50m140-50v50" fill="#9a8965" />
          <path d="M105 705h115v35H105z" fill="#c7c5a6" />
          <path d="M115 713h95m-95 9h95" stroke="#a1aa8f" strokeWidth="3" />
        </>
      )
    case 'premium-observatory':
      return (
        <>
          <Reader
            castId="observatory-resident"
            x={555}
            y={618}
            pose="writing"
            view="profile"
            standing
          />
          <path
            d="M360 595v-40m0 40-80 210m80-210 95 210m-95-210 8 220"
            stroke="#a1ac98"
            strokeWidth="10"
            fill="none"
          />
          <path
            d="M330 540h60v55h-60zM330 500l30 45"
            fill="#7b9492"
            stroke="#7b9492"
            strokeWidth="15"
          />
          <path
            d="m215 350 195 125-35 55-195-125z"
            fill="#9baead"
            stroke="#628384"
            strokeWidth="6"
          />
          <ellipse
            cx="198"
            cy="375"
            rx="28"
            ry="42"
            transform="rotate(32 198 375)"
            fill="#28525a"
            stroke="#c3cfb6"
            strokeWidth="7"
          />
          <path d="m390 489 55 34" stroke="#7f9d96" strokeWidth="20" />
          <Table x={640} y={700} width={195} kind="round" />
          <Book x={620} y={680} scale={0.65} />
          <Cup x={700} y={662} scale={0.7} />
          <Plant x={80} y={745} kind="leaf" scale={0.7} />
        </>
      )
    case 'premium-moon-base':
      return (
        <>
          <path d="M80 610h640l35 110H45z" fill="#8ca49a" />
          <path d="M110 625h185v60H95m230-60h165v60H310m210-60h165l18 60H505" fill="#305f66" />
          {[190, 400, 600].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy="655" r="23" fill="none" stroke="#87b7a6" strokeWidth="3" />
              <path d={`M${x} 635v40m-20-20h40`} stroke="#87b7a6" strokeWidth="2" />
              {i === 1 && <circle cx="408" cy="645" r="6" fill="#b7c6a0" />}
            </g>
          ))}
          <Reader castId="moon-base-resident" x={265} y={615} pose="laptop" color="#7e9b9a" />
          <path d="M660 735v-95q0-40 45-40t45 40v95z" fill="#8aab9e" opacity=".5" />
          <Plant x={705} y={705} kind="leaf" scale={0.45} />
          <Pet x={145} y={775} color="#c1cabc" scale={0.7} />
        </>
      )
    case 'premium-cloud-post':
      return (
        <>
          <Shelf x={35} y={390} width={140} rows={3} />
          <Table x={430} y={680} width={450} />
          <Reader
            castId="cloud-post-resident"
            view="profile"
            haircut="curly"
            hair="#706551"
            x={430}
            y={635}
            pose="writing"
            color="#8c8068"
          />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${220 + i * 85} ${633 + (i % 2) * 13}h70v35h-70zM${220 + i * 85} ${633 + (i % 2) * 13}l35 20 35-20`}
              fill="#c3b797"
              stroke="#998f70"
              strokeWidth="2"
            />
          ))}
          <path d="M650 620q40-50 90 0l10 145h-110z" fill="#a2926b" />
          <path d="M660 630h60" stroke="#6f7052" strokeWidth="7" />
          <path d="M75 330h110v15H75" fill="#927e57" />
          <Pet x={125} y={315} kind="owl" color="#bbb08c" scale={0.7} />
          <Cup x={535} y={642} />
        </>
      )
    case 'premium-personal-roastery':
      return (
        <>
          <Reader
            castId="personal-roastery-resident"
            x={475}
            y={615}
            pose="writing"
            view="profile"
            standing
          />
          <path d="M70 510h215v225H70z" fill="#63716a" />
          <ellipse cx="180" cy="510" rx="107" ry="30" fill="#899382" />
          <path d="M238 483h34v27h-34z" fill="#a2a68a" stroke="#65766b" strokeWidth="4" />
          <circle cx="180" cy="625" r="65" fill="#3b5149" stroke="#a0a38c" strokeWidth="9" />
          <path d="M150 430h65l50 55H100z" fill="#a6a88d" />
          <path d="M180 430V310h55v-95" stroke="#849184" strokeWidth="28" fill="none" />
          <path d="M80 735v85m190-85v85" stroke="#5b6958" strokeWidth="16" />
          <Table x={535} y={700} width={330} />
          <Book x={510} y={680} scale={0.7} />
          <Cup x={620} y={665} />
          <path d="M390 420h355v16H390M420 300h310v15H420" stroke="#8c7956" strokeWidth="6" />
          {Array.from({ length: collection }, (_, i) => (
            <Cup
              key={i}
              x={425 + i * 51}
              y={397}
              scale={0.55}
              steam={false}
              color={['#c7b18d', '#93aba0', '#aaa48b', '#b78f78', '#8b9eab', '#cab79b'][i]}
            />
          ))}
          <Plant x={735} y={740} kind="leaf" scale={0.65} />
          <Pet x={375} y={775} color="#b39d7b" scale={0.75} />
        </>
      )
    case 'premium-memory-house':
      return (
        <>
          <Frame x={40} y={180} width={100} height={115}>
            <path d="m15 80 30-40 35 40" fill="#9aa88a" />
          </Frame>
          <Frame x={665} y={180} width={100} height={115}>
            <circle cx="50" cy="45" r="17" fill="#a59d7d" />
          </Frame>
          <Reader
            castId="memory-house-resident"
            view="front"
            haircut="bob"
            x={270}
            y={630}
            pose="reading"
            color="#92816a"
            hair="#8a8272"
          />
          <Table x={420} y={680} width={380} />
          <Cup x={540} y={645} />
          <Plant x={730} y={735} kind="flower" scale={0.8} />
          <path d="M45 500h110v15H45" fill="#9a815b" />
          {Array.from({ length: collection }, (_, i) => (
            <g key={i}>
              <path
                d={`M${45 + i * 17} 500v-45h12v45`}
                fill={['#a68e61', '#6d8a79', '#ac8271'][i % 3]}
              />
              {i > 2 && <Frame x={545 + (i - 3) * 50} y={360} width={43} height={55} />}
            </g>
          ))}
          <Pet x={660} y={765} color="#b7ac90" />
          <Cushion x={130} y={750} color="#8a967b" />
        </>
      )
    default:
      return null
  }
}
export default function PremiumScene({
  spaceId,
  layer = 'all',
  coffeeCount = 0,
  paused = false,
  static: stationary = false,
}: {
  spaceId: string
  layer?: 'all' | 'rear' | 'foreground'
  coffeeCount?: number
  paused?: boolean
  static?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const geometry = premiumGeometry(spaceId)
  const aperture = `${uid}-premium-opening`
  return (
    <PremiumInteriorProvider value={PREMIUM_INTERIORS[spaceId]!}>
      <svg
        className="premium-artwork"
        viewBox="0 0 800 820"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        data-premium-space={spaceId}
        data-premium-layer={layer}
        data-paused={paused}
        data-static={stationary}
      >
        <defs>
          <clipPath id={aperture}>
            <path d={geometry.opening} />
          </clipPath>
          <linearGradient id={`${uid}-sky`} x2="0" y2="1">
            <stop stopColor="#102c38" />
            <stop offset="1" stopColor="#526c60" />
          </linearGradient>
        </defs>
        {layer !== 'foreground' && (
          <g data-premium-layer="rear">
            <path d="M0 0h800v820H0z" fill={geometry.wall} />
            <g clipPath={`url(#${aperture})`}>
              <path d="M0 0h800v820H0z" fill={`url(#${uid}-sky)`} />
              <Landscape id={spaceId} />
            </g>
            <path d={geometry.opening} stroke={geometry.trim} strokeWidth="17" fill="none" />
            <path d={geometry.frames} stroke={geometry.trim} strokeWidth="10" fill="none" />
            <path d="M0 590q400 25 800 0v230H0z" fill={geometry.floor} />
            <path
              d="M0 660 800 625M0 730l800-55M100 820l560-180"
              stroke="#c0a67b"
              strokeWidth="2"
              strokeOpacity=".18"
            />
            <PremiumMaterials spaceId={spaceId} opening={geometry.opening} />
            {spaceId === 'premium-newyear-attic' && (
              <path d="M0 0h110L0 440M800 0H690l110 440" fill="#5b5140" />
            )}
            {spaceId === 'premium-neon-loft' && (
              <path d="M478 0v590" stroke="#4e6470" strokeWidth="25" />
            )}
          </g>
        )}
        {layer === 'all' && (
          <PremiumAtmosphereDrawing spaceId={spaceId} paused={paused} static={stationary} />
        )}
        {layer !== 'rear' && (
          <g data-premium-layer="foreground">
            {spaceId === 'premium-autumn-lake' && (
              <AutumnFallingLeaves
                scene={spaceId}
                opening={geometry.opening}
                frames={geometry.frames}
                frameWidth={10}
              />
            )}
            <OutsideLife id={spaceId} clip={aperture} />
            <PremiumSignatureDetails
              spaceId={spaceId}
              layer="background"
              coffeeCount={coffeeCount}
            />
            <PremiumArchitecture spaceId={spaceId} />
            <ThemeMachine spaceId={spaceId} />
            <Interior id={spaceId} coffeeCount={coffeeCount} />
            <LegendaryForeground spaceId={spaceId} />
            {geometry.light.map(([x, y], i) => (
              <Lamp
                key={i}
                x={x}
                y={y}
                kind={
                  spaceId.includes('attic') || spaceId === 'premium-memory-house'
                    ? 'floor'
                    : spaceId.includes('teahouse') || spaceId.includes('garden')
                      ? 'orb'
                      : spaceId.includes('lighthouse') ||
                          spaceId.includes('treetop') ||
                          spaceId.includes('alchemy')
                        ? 'lantern'
                        : 'pendant'
                }
              />
            ))}
            <PremiumSignatureDetails
              spaceId={spaceId}
              layer="foreground"
              coffeeCount={coffeeCount}
            />
          </g>
        )}
      </svg>
    </PremiumInteriorProvider>
  )
}
