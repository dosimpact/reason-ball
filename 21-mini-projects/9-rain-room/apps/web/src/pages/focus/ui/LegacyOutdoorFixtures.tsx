import { useSceneLayer } from './SceneLayer'
/** Original small outdoor fixtures stay vector; only the distant terrain is rasterized. */
export default function LegacyOutdoorFixtures({ scene }: { scene: number }) {
  if (useSceneLayer() === 'rear') return null
  if (scene === 3)
    return (
      <g data-vector-outdoor="string-lights">
        <path d="M0 90q400 150 800 0" fill="none" stroke="#665d46" strokeWidth="3" />
        {[70, 200, 340, 480, 620, 750].map((x, i) => (
          <circle key={x} cx={x} cy={105 + Math.sin((i / 5) * Math.PI) * 65} r="7" fill="#ebcc8b" />
        ))}
      </g>
    )
  if (scene === 12)
    return (
      <g data-vector-outdoor="fireflies">
        {Array.from({ length: 28 }, (_, i) => (
          <circle
            key={i}
            cx={80 + ((i * 137) % 660)}
            cy={220 + ((i * 71) % 490)}
            r={(i % 3) + 2}
            fill="#c3ce8a"
            opacity={0.3 + (i % 3) * 0.2}
            className="scene-firefly"
          />
        ))}
      </g>
    )
  if (scene === 31)
    return (
      <g data-vector-outdoor="fireflies">
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i}>
            <circle
              cx={110 + ((i * 137) % 580)}
              cy={250 + ((i * 89) % 290)}
              r="6"
              fill="#b2d6a0"
              opacity=".08"
            />
            <circle
              className="scene-firefly"
              cx={110 + ((i * 137) % 580)}
              cy={250 + ((i * 89) % 290)}
              r={(i % 3) + 1.5}
              fill="#d1df9b"
              opacity=".65"
            />
          </g>
        ))}
      </g>
    )
  return null
}
