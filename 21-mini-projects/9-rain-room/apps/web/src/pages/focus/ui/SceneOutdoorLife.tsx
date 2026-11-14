import { useId } from 'react'
import type { Background } from '../model/backgrounds'
import SceneWildlife from './SceneWildlife'
import { useSceneLayer } from './SceneLayer'
import { getSceneArchitecture } from '../model/sceneArchitecture'
import { WindowRegion } from './SceneWindow'
export default function SceneOutdoorLife({ background }: { background: Background }) {
  const id = useId().replace(/:/g, '')
  const layer = useSceneLayer()
  const architecture = getSceneArchitecture(background.scene)
  const floor =
    background.scene === 0
      ? 619
      : background.scene === 35
        ? 535
        : background.scene === 36
          ? 644
          : architecture.kind === 'terrace'
            ? 655
            : 580
  return (
    <g className="scene-outdoor-life">
      <defs>
        <clipPath id={`${id}-outside`}>
          <WindowRegion scene={background.scene} />
        </clipPath>
        <mask id={`${id}-fixed-occlusion`}>
          <rect width="800" height="820" fill="white" />
          <path
            d={architecture.frames}
            stroke="black"
            strokeWidth={
              background.scene === 36 ? 9 : background.scene === 35 ? 12 : architecture.frameWidth
            }
            fill="none"
          />
          <path
            d={architecture.opening}
            stroke="black"
            strokeWidth={
              background.scene === 0 || architecture.kind === 'terrace'
                ? 0
                : background.scene === 35
                  ? 12
                  : background.scene === 36
                    ? 9
                    : 25
            }
            fill="none"
          />
          <path d={`M0 ${floor}H800V820H0Z`} fill="black" />
          {architecture.kind === 'terrace' && (
            <path d="M48 130H78V650H48Z M722 130H752V650H722Z" fill="black" />
          )}
        </mask>
      </defs>
      <g clipPath={`url(#${id}-outside)`}>
        <g mask={layer === 'foreground' ? `url(#${id}-fixed-occlusion)` : undefined}>
          <SceneWildlife background={background} />
        </g>
      </g>
    </g>
  )
}
