import { useId } from 'react'
import { getSceneInterior } from '../model/sceneInterior'
export default function SceneTable({
  scene,
  occupied = true,
}: {
  scene: number
  occupied?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const table = getSceneInterior(scene).table
  const left = occupied ? 105 : 214,
    right = occupied ? 695 : 586,
    top = occupied ? 608 : 660,
    width = right - left,
    front = top + (occupied ? 38 : 27)
  const surface =
    table.shape === 'oval' || table.shape === 'round'
      ? `M${left + 48} ${top}H${right - 48}Q${right + 20} ${top} ${right} ${front - 8}Q400 ${front + 22} ${left} ${front - 8}Q${left - 20} ${top} ${left + 48} ${top}Z`
      : table.shape === 'live-edge'
        ? `M${left} ${top + 4}Q${left + 50} ${top - 3} ${left + 95} ${top}H${right - 65}Q${right - 25} ${top + 7} ${right} ${top + 1}V${front}Q${right - 70} ${front - 5} ${right - 120} ${front + 3}H${left + 100}Q${left + 30} ${front - 5} ${left} ${front + 2}Z`
        : table.shape === 'stone'
          ? `M${left + 7} ${top}H${right - 8}L${right} ${top + 7}V${front}L${right - 12} ${front + 6}H${left + 8}L${left} ${front - 2}V${top + 6}Z`
          : table.shape === 'counter'
            ? `M${left - 14} ${top}H${right + 14}V${front - 6}L${right - 10} ${front + 6}H${left - 14}Z`
            : table.shape === 'tea'
              ? `M${left} ${top}H${right}V${front - 8}H${left}Z`
              : `M${left + 8} ${top}H${right - 8}Q${right} ${top} ${right} ${top + 8}V${front}H${left}V${top + 8}Q${left} ${top} ${left + 8} ${top}Z`
  const support = table.shape === 'tea' ? front - 8 : front - 6
  return (
    <g data-table-shape={table.shape} data-table-material={table.material} data-contact-y={top}>
      <defs>
        <clipPath id={`${id}-top`}>
          <path d={surface} />
        </clipPath>
      </defs>
      {table.support === 'pedestal' ? (
        <>
          <path d={`M400 ${support}V805`} stroke={table.edge} strokeWidth="28" />
          <ellipse cx="400" cy="805" rx={occupied ? 115 : 80} ry="15" fill={table.edge} />
        </>
      ) : table.support === 'slab' ? (
        <>
          <path
            d={`M${left + 35} ${support}h35v${820 - support}h-35Z M${right - 70} ${support}h35v${820 - support}h-35Z`}
            fill={table.edge}
          />
          <path
            d={`M${left + 42} ${support + 4}V820M${right - 65} ${support + 4}V820`}
            stroke={table.surface}
            opacity=".3"
            strokeWidth="3"
          />
        </>
      ) : table.support === 'brackets' ? (
        <path
          d={`M${left + 45} ${support}v95l70-95M${right - 45} ${support}v95l-70-95`}
          fill="none"
          stroke={table.edge}
          strokeWidth="10"
        />
      ) : table.support === 'trestle' ? (
        <>
          <path
            d={`M${left + 65} ${support}l-35 ${820 - support}m35-${820 - support} 40 ${820 - support}M${right - 65} ${support}l-40 ${820 - support}m40-${820 - support} 35 ${820 - support}`}
            stroke={table.edge}
            strokeWidth="12"
          />
          <path d={`M${left + 58} 755H${right - 58}`} stroke={table.edge} strokeWidth="9" />
        </>
      ) : (
        <path
          d={`M${occupied ? 155 : 245} ${support}V820M${occupied ? 645 : 555} ${support}V820`}
          stroke={table.edge}
          strokeWidth={table.shape === 'tea' ? 26 : 18}
        />
      )}
      <path
        d={surface}
        fill={table.surface}
        stroke={table.edge}
        strokeWidth={table.material === 'glass' ? 3 : 1}
      />
      <g
        clipPath={`url(#${id}-top)`}
        fill="none"
        stroke={
          table.material === 'metal'
            ? '#b4c3bd'
            : table.material === 'stone'
              ? '#d1d3c1'
              : '#d5bc8c'
        }
        opacity={table.material === 'glass' ? 0.28 : 0.2}
        strokeWidth="1.5"
      >
        {table.material === 'stone' ? (
          <>
            <path
              d={`M${left - 20} ${top + 18}q110-23 180 10t170-7 150 2m-400-25 90 60m155-51-24 58`}
            />
          </>
        ) : table.material === 'metal' ? (
          <>
            <path d={`M${left} ${top + 8}H${right}M${left} ${front - 8}H${right}`} />
            {[left + 20, right - 20].map((x) => (
              <circle key={x} cx={x} cy={top + 18} r="2" />
            ))}
          </>
        ) : table.material === 'glass' ? (
          <>
            <path
              d={`M${left + 35} ${top}l70 65m-30-65 70 65M${right - 120} ${top}l70 65`}
              strokeWidth="8"
              opacity=".5"
            />
          </>
        ) : (
          <>
            <path
              d={`M${left} ${top + 14}q120-7 210 0t${width - 210} 0M${left} ${top + 26}q90 7 220 0t${width - 220} 0`}
            />
            {table.material === 'bamboo' &&
              [0, 1, 2, 3].map((index) => (
                <path key={index} d={`M${left + index * 100} ${top}v70`} />
              ))}
          </>
        )}
      </g>
      {table.shape === 'fold-down' && (
        <path d={`M${left + 10} ${top + 1}h${width - 20}`} stroke="#b0b29a" strokeWidth="3" />
      )}
    </g>
  )
}
