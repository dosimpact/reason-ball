import { useId } from 'react'
import { getDrink, type DrinkId, type Temperature } from '../../model/cafeRitual'

export default function DrinkCup({
  drinkId,
  temperature,
  size = 88,
  steam = false,
}: {
  drinkId: DrinkId
  temperature: Temperature
  size?: number
  steam?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const cold = temperature === 'iced'
  const color = getDrink(drinkId).colors.liquid
  return (
    <svg
      className={`ritual-cup ${steam ? 'ritual-cup-steaming' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`cup-${id}`} x2="1" y2="1">
          <stop stopColor="#f5e8d1" />
          <stop offset="1" stopColor="#c8b79d" />
        </linearGradient>
      </defs>
      <ellipse cx="58" cy="104" rx="42" ry="7" fill="#000" opacity=".14" />
      {cold ? (
        <>
          <path d="M33 30h52l-6 67q-20 11-40 0Z" fill="#d4e0d6" opacity=".7" />
          <path d="M36 47h46l-5 47q-17 8-35 0Z" fill={color} />
          <path d="m68 17-10 65" stroke="#c2b08b" strokeWidth="4" />
          {[43, 58, 70].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={39 + (i % 2) * 8}
              width="12"
              height="14"
              rx="3"
              fill="#e3eee5"
              opacity=".65"
              transform={`rotate(${i * 12 - 12} ${x} 45)`}
            />
          ))}
        </>
      ) : (
        <>
          <ellipse cx="57" cy="99" rx="38" ry="5" fill="#d3c4ab" />
          <path d="M81 49h8c22 0 21 31-8 30" fill="none" stroke="#d6c6ad" strokeWidth="9" />
          <path d="M28 43h57l-4 38q-3 17-25 17T32 81Z" fill={`url(#cup-${id})`} />
          <ellipse cx="56" cy="44" rx="28" ry="8" fill="#e9d8bd" />
          <ellipse cx="56" cy="44" rx="23" ry="5" fill={color} />
          {String(drinkId).includes('latte') && (
            <path d="M47 44q9-8 18 0-9 7-18 0" fill="#eee0c4" opacity=".85" />
          )}
        </>
      )}
      {steam && (
        <g
          className={cold ? 'ritual-aroma' : 'ritual-steam'}
          fill="none"
          stroke="#ede0c8"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {[43, 57, 70].map((x, i) => (
            <path
              key={x}
              style={{ animationDelay: `${i * 0.35}s` }}
              d={`M${x} 29q-7-9 0-17t0-12`}
            />
          ))}
        </g>
      )}
    </svg>
  )
}
