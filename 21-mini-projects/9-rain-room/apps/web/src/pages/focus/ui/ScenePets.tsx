import type { Background } from '../model/backgrounds'
import { getSceneAnimals, type SceneAnimal } from '../model/sceneAnimals'

function Cat({ coat, marking, pose }: SceneAnimal) {
  return (
    <g data-pet="cat" data-pet-pose={pose ?? 'loaf'}>
      <ellipse cx="0" cy="10" rx="52" ry="13" fill="#18231c" opacity=".35" />
      <path
        d={
          pose === 'curled'
            ? 'M-48 4q-12-39 18-43 36-2 45 33L29 9z'
            : pose === 'stretched'
              ? 'M-56 7q-8-22 22-27 35-7 60 7l11 22z'
              : 'M-48 5q-3-35 30-39 35-4 52 15 20 21-8 27z'
        }
        fill={coat}
      />
      <path
        d={pose === 'curled' ? 'M-40-9q-22 29 15 26 23-2 16-15' : 'M-36-11q-26-16-24 5 1 16 26 14'}
        fill="none"
        stroke={marking ?? coat}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="M9-12 5-37l17 12 20-11 1 25q-2 22-19 21Q8 10 9-12" fill={coat} />
      <path d="m10-29 3 13 8-7m15-1 5 8-1-14" fill={marking ?? coat} />
      <path
        d="M17-6q4 4 8 0m7 0q4 4 8 0"
        stroke="#5d5746"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="m27 0 3 2 3-2" stroke="#896e5d" fill="none" strokeWidth="2" />
      <path
        d="M-14-25q-8 10-2 18m12-16q-7 9-2 14"
        stroke={marking ?? coat}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M11 7h14m10 0h10" stroke="#d2be9c" strokeWidth="5" strokeLinecap="round" />
    </g>
  )
}
function Dog({ coat, marking }: SceneAnimal) {
  return (
    <g data-pet="dog" data-pet-pose="resting-on-mat">
      <ellipse cx="0" cy="15" rx="69" ry="19" fill="#26372d" />
      <ellipse cx="0" cy="13" rx="61" ry="13" fill="#536451" />
      <path
        d="M-48 1q-15-23-4-31"
        fill="none"
        stroke={coat}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="M-46 6q-7-35 29-39 32-4 44 21l4 19z" fill={coat} />
      <path d="M11-13q-8-25 12-27 26-3 30 23l9 10q-1 13-21 13H17z" fill={coat} />
      <path d="M15-35q-20 0-14 24 5 14 16 6l5-29z" fill={marking ?? coat} />
      <path
        d="M36-13q5 4 10 0"
        fill="none"
        stroke="#504a3d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="58" cy="-6" rx="5" ry="4" fill="#41473a" />
      <path d="M20 9h24m-64 1H-2" stroke="#c6ad85" strokeWidth="10" strokeLinecap="round" />
      <path d="M23-1q7 7 20 5" stroke="#947c5b" strokeWidth="2" fill="none" />
    </g>
  )
}
export default function ScenePets({ background }: { background: Background }) {
  return (
    <g className="scene-pets" aria-hidden="true">
      {getSceneAnimals(background)
        .filter((animal) => animal.habitat === 'indoor')
        .map((animal, index) => (
          <g
            key={index}
            data-animal-habitat="indoor"
            transform={`translate(${animal.x} ${animal.y}) scale(${animal.scale})`}
          >
            {animal.species === 'cat' ? (
              <>
                {background.scene !== 34 && (
                  <>
                    <path d="M-62 13H62v15H-62z" fill="#6d5d44" />
                    <path d="M-52 28v36m104-36v36" stroke="#514831" strokeWidth="7" />
                    <path d="M-60 10q60-14 120 0v9H-60z" fill="#53614b" />
                  </>
                )}
                <Cat {...animal} />
              </>
            ) : (
              <>
                <path d="M-76 23H76v13H-76z" fill="#66543d" />
                <path d="M-65 36v33m130-33v33" stroke="#493e2c" strokeWidth="7" />
                <Dog {...animal} />
              </>
            )}
          </g>
        ))}
    </g>
  )
}
