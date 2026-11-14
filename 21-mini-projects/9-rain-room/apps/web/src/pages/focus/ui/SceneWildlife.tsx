import type { Background } from '../model/backgrounds'
import { getSceneAnimals, type SceneAnimal } from '../model/sceneAnimals'
function Wildlife({ species, coat, marking = '#d4c6a6', support }: SceneAnimal) {
  const eye = <circle cx="25" cy="-38" r="2.2" fill="#273830" />
  const leg = {
    fill: 'none',
    stroke: coat,
    strokeWidth: 5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <g data-wildlife={species} data-support={support}>
      {support === 'ground' && (
        <>
          <ellipse cy="3" rx="55" ry="5" fill="#203d2b" opacity=".4" />
          <path
            d="M-80 7q25-12 45-5m61 2q24-14 49-6"
            stroke="#5c7252"
            strokeWidth="4"
            fill="none"
          />
        </>
      )}
      {support === 'branch' && (
        <path
          d="M-65 17Q100-8 1200-90M-20 10l-18-20m72 14 22-18"
          stroke="#5d6346"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {support === 'post' && (
        <>
          <path d="M-10 2h32v400H-10z" fill="#6a7059" />
          <path d="M-17 0h46" stroke="#a9a88d" strokeWidth="8" />
        </>
      )}
      {support === 'water' && (
        <g fill="none" stroke="#93b0a0" opacity=".5">
          <ellipse cy="6" rx="60" ry="8" />
          <path d="M-82 13q80 11 164 0" />
        </g>
      )}
      {species === 'deer' && (
        <>
          <path d="M-32-43-35-4h-8m35-35L-4-3h-8M22-40 27-3h8m-3-37L40-4h7" {...leg} />
          <ellipse cx="-6" cy="-50" rx="49" ry="24" fill={coat} />
          <path d="M20-49q8-16 9-41l14-2q8 35 0 57z" fill={coat} />
          <path d="M28-96q14-17 30-7l16 9-7 12-26-2z" fill={coat} />
          <path d="M35-99 17-116q-4 20 16 28M45-104l10-24q14 21-3 28" fill={coat} />
          <ellipse cx="51" cy="-99" rx="2.5" ry="2" fill="#25382d" />
          <ellipse cx="70" cy="-91" rx="4" ry="3" fill="#3a4431" />
          <path d="M-51-56q-27-12-15-20l20 17" fill={marking} />
          {[-31, -12, 7].map((x, i) => (
            <g key={x} fill={marking}>
              <ellipse cx={x} cy={-55 - (i % 2) * 5} rx="4" ry="3" />
              <ellipse cx={x + 7} cy="-43" rx="3" ry="2" />
            </g>
          ))}
        </>
      )}
      {species === 'fox' && (
        <>
          <path d="M-26-32-28 0h-9m43-33 7 32h10m9-36L35-1h10" {...leg} />
          <path d="M-31-24q-61 34-76-8 35 12 55-13" fill={coat} />
          <path d="M-86-29q-16-2-21-3 6 24 28 21" fill={marking} />
          <ellipse cy="-36" rx="43" ry="21" fill={coat} />
          <path d="m19-48 3-30 18 15 17-8-4 25 20 12-20 11-28-7z" fill={coat} />
          <path d="m36-39 37 5-20 11-21-8" fill={marking} />
          <path d="m28-64-3-10-1 15m24 3 4-11-10 7" fill="#655640" />
          <circle cx="46" cy="-46" r="2.5" fill="#26352c" />
          <circle cx="70" cy="-34" r="3" fill="#26352c" />
        </>
      )}
      {species === 'rabbit' && (
        <>
          <ellipse cx="-12" cy="-18" rx="30" ry="23" fill={coat} />
          <circle cx="-40" cy="-17" r="11" fill={marking} />
          <ellipse cx="15" cy="-35" rx="18" ry="20" fill={coat} />
          <ellipse cx="8" cy="-67" rx="7" ry="25" transform="rotate(-12 8 -67)" fill={coat} />
          <ellipse cx="24" cy="-69" rx="7" ry="26" transform="rotate(10 24 -69)" fill={coat} />
          <path d="M9-76v21m16-25-2 24" stroke={marking} strokeWidth="4" strokeLinecap="round" />
          <path d="M-30-3h19m20 0h24" stroke={coat} strokeWidth="9" strokeLinecap="round" />
          {eye}
          <circle cx="32" cy="-28" r="2.5" fill="#7d7560" />
        </>
      )}
      {species === 'squirrel' && (
        <>
          <path d="M-16-10q-54 12-42-45 9-38 28-20 17 16-10 34 19-9 30 7" fill={coat} />
          <path d="M-42-62q-10 22 6 28" fill="none" stroke={marking} strokeWidth="7" />
          <ellipse cy="-20" rx="19" ry="28" fill={coat} />
          <ellipse cx="14" cy="-47" rx="18" ry="17" fill={coat} />
          <path d="m1-57 3-19 10 16m5 0 9-15 1 22" fill={coat} />
          <ellipse cy="-19" rx="10" ry="18" fill={marking} />
          <path d="M11-30 25-19m-34 18h18" {...leg} />
          {eye}
        </>
      )}
      {species === 'owl' && (
        <>
          <ellipse cy="-35" rx="27" ry="35" fill={coat} />
          <path
            d="M-25-42q-15 24 4 44l10-31m36-13q15 24-4 44L11-29"
            fill={coat}
            stroke={marking}
            strokeWidth="2"
          />
          <path d="M-26-56-28-79l16 13q12-5 24 0l16-13-2 23z" fill={coat} />
          <circle cx="-11" cy="-56" r="15" fill={marking} />
          <circle cx="11" cy="-56" r="15" fill={marking} />
          <circle cx="-10" cy="-56" r="5" fill="#2b3b32" />
          <circle cx="10" cy="-56" r="5" fill="#2b3b32" />
          <path d="m-4-47 4 9 4-9" fill="#b8a176" />
          <path d="M-13-24v6m13-9v6m13-3v6" stroke={marking} strokeWidth="3" />
          <path d="M-13-2v7m5-7v7m16-7v5m5-8v7" stroke="#9e9574" strokeWidth="3" />
        </>
      )}
      {species === 'heron' && (
        <>
          <path d="M-10-42-13-3h-12m24-37L9-3h13" stroke="#9b9c76" strokeWidth="4" fill="none" />
          <path d="M-38-55q35-25 57 3L1-32-38-41-55-31z" fill={coat} />
          <path
            d="M7-50q30-20 3-34-21-16 8-35"
            fill="none"
            stroke={coat}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <ellipse cx="23" cy="-119" rx="14" ry="10" fill={coat} />
          <path d="m34-122 30 8-31 2" fill="#b7ab79" />
          <circle cx="28" cy="-121" r="2.5" fill="#283c33" />
          <path d="M-31-51 6-43-25-39" fill={marking} />
        </>
      )}
      {species === 'duck' && (
        <>
          <path d="M-42-18q15-28 49-12 23 13 20 29H-34l-20-16z" fill={coat} />
          <path d="M-25-16q22-16 38 7l-34 7z" fill={marking} />
          <path d="M14-8q-11-18-1-32 6-9 20-5l5 21-11 20" fill={marking} />
          <circle cx="25" cy="-36" r="2.5" fill="#263a30" />
          <path d="m36-33 20 6-21 3" fill="#b6a477" />
        </>
      )}
      {(species === 'gull' || species === 'songbird') && (
        <>
          {support === 'flight' ? (
            <>
              <path d="M0-28q-35-48-82-20 43-3 65 32M0-28q35-48 82-20-43-3-65 32" fill={marking} />
              <ellipse cy="-20" rx="19" ry="12" fill={coat} />
              <circle cx="21" cy="-27" r="10" fill={coat} />
              <path d="m30-29 17 5-17 3" fill="#b9aa7a" />
              <circle cx="24" cy="-30" r="2" fill="#263c32" />
            </>
          ) : (
            <>
              <path d="M-8-8-11 2h-8m26-10 5 10h7" stroke="#a6a17d" strokeWidth="3" fill="none" />
              <ellipse cy="-22" rx="26" ry="17" fill={coat} />
              <path d="M-6-32q-8 25-34 10l-19-1 28 18L9-12z" fill={marking} />
              <circle cx="22" cy="-36" r="13" fill={coat} />
              <path d="m33-39 18 5-19 3" fill="#b9aa7a" />
              <circle cx="25" cy="-39" r="2" fill="#263c32" />
            </>
          )}
        </>
      )}
    </g>
  )
}
export default function SceneWildlife({ background }: { background: Background }) {
  const animals = getSceneAnimals(background).filter((animal) => animal.habitat === 'outdoor')
  const ground = animals.find((animal) => animal.support === 'ground')
  const snow = [23, 29].includes(background.scene)
  return (
    <g className="scene-wildlife" aria-hidden="true">
      {ground && (
        <g data-wildlife-terrain="connected-bank">
          <path
            d={`M0 ${ground.y + 28}Q${ground.x / 2} ${ground.y + 22} ${ground.x} ${ground.y}Q${(ground.x + 800) / 2} ${ground.y + 10} 800 ${ground.y + 15}V820H0z`}
            fill={snow ? '#9ba694' : '#405942'}
          />
          <path
            d={`M0 ${ground.y + 43}Q${ground.x / 2} ${ground.y + 40} ${ground.x} ${ground.y + 16}T800 ${ground.y + 31}`}
            fill="none"
            stroke={snow ? '#b5beaa' : '#526c4d'}
            strokeWidth="3"
            opacity=".6"
          />
        </g>
      )}
      {animals.map((animal, index) => (
        <g
          key={index}
          data-animal-habitat="outdoor"
          transform={`translate(${animal.x} ${animal.y}) scale(${animal.scale})`}
        >
          <Wildlife {...animal} />
        </g>
      ))}
    </g>
  )
}
