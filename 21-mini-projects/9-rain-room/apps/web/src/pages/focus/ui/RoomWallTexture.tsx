import { useId } from 'react'
import { getSceneInterior } from '../model/sceneInterior'
import { getSceneArchitecture } from '../model/sceneArchitecture'
export default function RoomWallTexture({ scene }: { scene: number }) {
  const id = useId().replace(/:/g, '')
  const interior = getSceneInterior(scene)
  const material = interior.wall.material
  const shape =
    interior.enclosure === 'terrace'
      ? 'M0 0H800V107L725 142H75L0 107Z M48 130H78V650H48Z M722 130H752V650H722Z'
      : `M0 0H800V600H0Z ${getSceneArchitecture(scene).opening}`
  return (
    <g data-wall-material={material}>
      <defs>
        <pattern
          id={`${id}-material`}
          width={
            material === 'brick' ? 96 : material === 'stone' ? 112 : material === 'logs' ? 48 : 64
          }
          height={material === 'brick' ? 44 : material === 'stone' ? 76 : 64}
          patternUnits="userSpaceOnUse"
        >
          <g stroke={interior.wall.detail} fill="none" strokeOpacity=".22" strokeWidth="1.5">
            {material === 'brick' ? (
              <path d="M0 1H96M0 23H96M0 43H96M47 1V23M0 23V43M95 23V43" />
            ) : material === 'slats' ? (
              <>
                <path d="M1 0V64M31 0V64M63 0V64" />
                <path d="M9 0V64M42 0V64" strokeOpacity=".09" />
              </>
            ) : material === 'logs' ? (
              <>
                <path d="M0 2H64M0 30H64M0 62H64" strokeWidth="5" />
                <path d="M4 11Q30 7 64 12M3 43Q35 38 64 44" />
              </>
            ) : material === 'panels' ? (
              <path d="M2 0V64M62 0V64M0 2H64M0 62H64" />
            ) : material === 'wallpaper' ? (
              <>
                <path d="M32 6Q10 20 32 33Q54 20 32 6ZM0 39Q-20 52 0 64Q20 52 0 39ZM64 39Q44 52 64 64" />
                <circle cx="32" cy="49" r="2" />
              </>
            ) : material === 'stone' ? (
              <path
                d="M0 4 46 0 112 9M0 43 62 38l50 9M0 75h112M46 0l-5 39m21 0 10 37"
                strokeWidth="2"
              />
            ) : material === 'canvas' ? (
              <>
                <path
                  d="M0 1H64M0 7H64M0 13H64M0 19H64M0 25H64M0 31H64M0 37H64M0 43H64M0 49H64M0 55H64M0 61H64"
                  strokeOpacity=".09"
                />
                <path d="M16 0V64M48 0V64" />
              </>
            ) : material === 'metal' ? (
              <>
                <path d="M0 2H64M2 0V64" />
                <circle cx="8" cy="8" r="1.6" />
                <circle cx="55" cy="55" r="1.6" />
              </>
            ) : material === 'lattice' ? (
              <path d="M2 0V64M32 0V64M62 0V64M0 2H64M0 32H64M0 62H64" strokeWidth="2.5" />
            ) : (
              <>
                <path d="M5 19l9-2m24 27 8 2m8-39 5 1" />
                <circle cx="20" cy="53" r="1" />
              </>
            )}
          </g>
        </pattern>
      </defs>
      <path d={shape} fillRule="evenodd" fill={`url(#${id}-material)`} />
    </g>
  )
}
