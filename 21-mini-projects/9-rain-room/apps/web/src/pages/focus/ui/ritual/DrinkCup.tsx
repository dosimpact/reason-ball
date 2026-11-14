import type { CSSProperties } from 'react'
import type { DrinkId, Temperature } from '../../model/cafeRitual'
import { DRINK_ARTWORK } from './drink-assets'
import './drink-cup.css'

type Props = { drinkId: DrinkId; temperature: Temperature; size?: number; steam?: boolean }

export default function DrinkCup({ drinkId, temperature, size = 88, steam = false }: Props) {
  const a = DRINK_ARTWORK[drinkId]
  const cold = temperature === 'iced'
  const tall = a.shape === 'milk-glass' || a.shape === 'tall-glass'
  const glass = tall || a.shape === 'glass-mug' || a.shape === 'round-glass'
  const top = tall ? 31 : a.shape === 'foam-bowl' ? 56 : 47
  const bottom = tall ? 101 : 96
  const left = a.shape === 'wide' ? 22 : a.shape === 'clay-cup' ? 34 : 28
  const right = a.shape === 'wide' ? 86 : a.shape === 'clay-cup' ? 79 : 83
  const cx = (left + right) / 2
  const rx = (right - left) / 2
  const body = tall
    ? 'M35 31h46l-5 67q-18 8-36 0Z'
    : a.shape === 'round-glass'
      ? 'M29 47h53q10 48-25 50T29 47Z'
      : a.shape === 'cocoa-mug'
        ? 'M29 47h53v33q0 18-27 18T29 80Z'
        : `M${left} ${top}h${right - left}l-5 ${bottom - top - 12}q-3 13-${rx - 5} 13t-${rx - 5}-13Z`
  return (
    <span
      className={`ritual-cup ritual-drink-artwork ${steam ? 'ritual-cup-steaming' : ''}`}
      style={{ '--drink-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
      data-drink-id={drinkId}
      data-temperature={temperature}
    >
      <svg
        className="ritual-drink-vector"
        viewBox="0 0 120 120"
        focusable="false"
        aria-hidden="true"
        data-cup-shape={a.shape}
      >
        <ellipse cx="58" cy="106" rx={tall ? 29 : 43} ry="6" fill={a.shade} opacity=".2" />
        {!tall && (
          <>
            <ellipse cx="57" cy="103" rx="41" ry="6" fill={a.shade} />
            <ellipse cx="57" cy="101" rx="38" ry="5" fill={a.cream} />
          </>
        )}
        {!tall && a.shape !== 'round-glass' && (
          <path
            d={`M${right - 1} ${top + 9}h8c19 0 19 28-9 28`}
            fill="none"
            stroke={a.body}
            strokeWidth="7"
          />
        )}
        <path d={body} fill={a.body} />
        <path
          d={
            tall
              ? 'M74 36h5l-5 60q-4 3-8 3Z'
              : `M${right - 8} ${top + 5}h6l-4 ${bottom - top - 18}q-5 10-15 10 12-9 13-26Z`
          }
          fill={a.shade}
          opacity=".42"
        />
        {glass && (
          <path
            d={
              tall
                ? 'M39 48h38l-4 47q-15 6-30 0Z'
                : a.shape === 'round-glass'
                  ? 'M32 60h48q3 33-23 33T32 60Z'
                  : 'M33 59h45v21q0 13-22 13T33 80Z'
            }
            fill={a.liquid}
          />
        )}
        {a.shape === 'milk-glass' && (
          <>
            <path d="M40 56h36l-2 23H42Z" fill={a.cream} />
            <path d="M42 79h32l-1 16q-15 6-30 0Z" fill="#b8a481" />
          </>
        )}
        {a.shape === 'round-glass' && <path d="M33 60h46l1 10H32Z" fill={a.cream} />}
        <ellipse
          cx={tall ? 58 : cx}
          cy={top}
          rx={tall ? 23 : rx}
          ry={tall ? 6 : 8}
          fill={a.cream}
        />
        <ellipse
          cx={tall ? 58 : cx}
          cy={top}
          rx={tall ? 20 : rx - 4}
          ry={tall ? 4 : 5.5}
          fill={a.liquid}
        />
        {drinkId === 'cafe-latte' && (
          <g fill="none" stroke={a.cream} strokeWidth="1.8" strokeLinecap="round">
            <path d="M57 42v11M57 47q-13-7-15-1 6 5 15 3m0-2q13-7 15-1-6 5-15 3M57 44q-7-6-9-2m9 2q7-6 9-2" />
          </g>
        )}
        {drinkId === 'vanilla-latte' && (
          <>
            <path
              d="M56 50C52 48 47 46 49 44C51 42 54 43 56 45C58 43 61 42 63 44C65 46 60 48 56 50Z"
              fill={a.cream}
            />
            <g stroke={a.shade} strokeWidth="1.4" opacity=".55">
              <path d="m37 60 3 26m9-25 1 30m12-30-1 30m11-31-3 26" />
            </g>
          </>
        )}
        {drinkId === 'cappuccino' && (
          <>
            <ellipse cx="55.5" cy="54" rx="24" ry="7" fill={a.cream} />
            <g fill={a.liquid} opacity=".5">
              <circle cx="49" cy="53" r="1" />
              <circle cx="59" cy="56" r="1.2" />
              <circle cx="65" cy="52" r=".8" />
            </g>
          </>
        )}
        {(drinkId === 'cafe-mocha' ||
          drinkId === 'hot-chocolate' ||
          drinkId === 'caramel-macchiato') && (
          <>
            <ellipse
              cx={tall ? 58 : cx}
              cy={top - 1}
              rx={tall ? 17 : rx - 6}
              ry="4.5"
              fill={a.cream}
            />
            <path
              d={tall ? 'm46 29 22 3m-20 0 19-4m-13-1 7 7' : 'm39 44 30 4m-26 1 22-7'}
              fill="none"
              stroke={drinkId === 'caramel-macchiato' ? '#a58b60' : a.liquid}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        )}
        {drinkId === 'hot-chocolate' && (
          <>
            <path d="M42 44q2-9 10-6 6-8 11 0 9-1 9 7Z" fill={a.cream} />
            <path d="m48 42 4 1m8-3 3 2" stroke={a.liquid} strokeWidth="1.5" />
          </>
        )}
        {drinkId === 'decaf-americano' && (
          <g fill="none" stroke={a.cream} strokeWidth="1.5">
            <path d="M56 84V69m0 7q-11-8-10-1 1 6 10 5m0-7q10-8 10-1-1 6-10 6" />
          </g>
        )}
        {cold && (
          <g
            data-drink-ice="true"
            fill="#d8dfcf"
            fillOpacity=".75"
            stroke={a.shade}
            strokeWidth=".6"
          >
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={tall ? 43 + i * 8 : cx - 14 + i * 9}
                y={top - 4 + (i % 2) * 4}
                width="10"
                height="8"
                rx="2"
                transform={`rotate(${i === 1 ? 12 : -12} ${tall ? 48 + i * 8 : cx - 9 + i * 9} ${top})`}
              />
            ))}
          </g>
        )}
        {cold && (
          <path
            d={tall ? 'm68 18-8 48' : `m${cx + 12} 31-8 30`}
            fill="none"
            stroke="#898d74"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {steam && (
          <g
            className={cold ? 'ritual-aroma' : 'ritual-steam'}
            fill="none"
            stroke="#cbbd9a"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            {[43, 57, 70].map((x, i) => (
              <path
                key={x}
                style={{ animationDelay: `${i * 0.35}s` }}
                d={`M${x} 26q-6-8 0-14t0-10`}
              />
            ))}
          </g>
        )}
      </svg>
    </span>
  )
}
