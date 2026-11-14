import RoomWallTexture from './RoomWallTexture'
import { getSceneArchitecture } from '../model/sceneArchitecture'
export default function RoomWindow({
  scene,
  wall,
  wood,
}: {
  scene: number
  wall: string
  wood: string
}) {
  const architecture = getSceneArchitecture(scene)
  if (architecture.kind === 'terrace')
    return (
      <g data-window-kind="terrace" data-enclosure="open-terrace">
        <path d="M0 0H800V107L725 142H75L0 107Z" fill={wall} />
        <path
          d="M0 107 75 142H725L800 107M48 130H78V650H48ZM722 130H752V650H722Z"
          fill={wood}
          stroke={wood}
          strokeWidth="4"
        />
        <RoomWallTexture scene={scene} />
        <path d="M0 574H800M0 586H800" stroke={wood} strokeWidth="9" />
        {[100, 240, 400, 560, 700].map((x) => (
          <path key={x} d={`M${x} 585v70`} stroke={wood} strokeWidth="7" />
        ))}
        <path d="M20 115H780" stroke="#b8b290" strokeWidth="3" opacity=".35" />
      </g>
    )
  return (
    <g data-window-kind={architecture.kind}>
      <path
        d={`M0 0H800V${scene === 12 ? 620 : 600}H0Z ${architecture.opening}`}
        fillRule="evenodd"
        fill={wall}
      />
      <RoomWallTexture scene={scene} />
      <path d={architecture.opening} fill="none" stroke="#0a1514" strokeWidth="25" />
      <path d={architecture.opening} fill="none" stroke={wood} strokeWidth="13" />
      <path d={architecture.opening} fill="none" stroke="#b8a078" strokeWidth="2" opacity=".24" />
      <path
        d={architecture.frames}
        fill="none"
        stroke={wood}
        strokeWidth={architecture.frameWidth}
      />
    </g>
  )
}
