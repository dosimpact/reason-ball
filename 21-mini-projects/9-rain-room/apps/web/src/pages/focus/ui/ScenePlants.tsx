import type { Background } from '../model/backgrounds'
import { getScenePlants, type ScenePlant, type PlantSpecies } from '../model/scenePlants'
function Foliage({ species, mask }: { species: PlantSpecies; mask: boolean }) {
  const leaf = mask
    ? '#000'
    : species === 'olive' || species === 'rosemary'
      ? '#7b9175'
      : species === 'succulent'
        ? '#83a18a'
        : '#56794f'
  const light = mask ? '#000' : '#82986a'
  const stem = mask ? '#000' : '#687852'
  const wood = mask ? '#000' : '#736246'
  const heart = 'M0 0C-13-17-30-4-18 10L0 28 18 10C30-4 13-17 0 0Z'
  return (
    <g fill={leaf} strokeLinecap="round">
      <path
        d="M0-18V-45"
        fill="none"
        stroke={
          ['bonsai', 'blossom', 'camellia', 'olive', 'rubber'].includes(species) ? wood : stem
        }
        strokeWidth="4"
      />
      {species === 'monstera' ? (
        <>
          <path
            d="M0-25Q-5-95 6-166M0-65-36-105M3-100 37-133"
            fill="none"
            stroke={stem}
            strokeWidth="5"
          />
          {[
            [-30, -110, -28],
            [32, -133, 30],
            [-5, -166, 4],
          ].map(([x, y, angle], index) => (
            <g key={index} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path
                d="M0 20C-45 20-44-25-18-40Q-9-44 0-32 18-48 35-27L20-20 38-16 24-8 40-5 24 3 34 9Q15 25 0 20Z M-19-20q-7 0-5 8 8 1 5-8Z M9-25q8 0 5 8-7 1-5-8Z"
                fillRule="evenodd"
              />
              <path d="M0 17V-31" stroke={light} strokeWidth="1.5" fill="none" />
            </g>
          ))}
        </>
      ) : species === 'rubber' ? (
        <>
          <path d="M0-25Q-4-80 0-172" stroke={wood} strokeWidth="6" fill="none" />
          {[-60, -105, -150].map((y, index) => (
            <g key={y}>
              <path d={`M0 ${y}l-25-16m25 16 24-24`} fill="none" stroke={stem} strokeWidth="3" />
              <ellipse
                cx="-24"
                cy={y - 16}
                rx="27"
                ry="13"
                transform={`rotate(22 -24 ${y - 16})`}
              />
              <ellipse
                cx="24"
                cy={y - 24}
                rx="27"
                ry="13"
                transform={`rotate(-27 24 ${y - 24})`}
                fill={index % 2 ? light : leaf}
              />
              <path
                d={`M-43 ${y - 23}l34 9m-2-8 35-13`}
                stroke={mask ? '#000' : '#9eac86'}
                strokeWidth="1"
                opacity={mask ? 1 : 0.65}
              />
            </g>
          ))}
        </>
      ) : species === 'pothos' || species === 'ivy' ? (
        <>
          <path
            d="M0-25Q-26-77-37-31T-26 69M2-26Q34-55 30-12T35 97"
            fill="none"
            stroke={stem}
            strokeWidth="3"
          />
          {[
            [-27, -48, -28],
            [23, -33, 20],
            [-37, -7, -25],
            [31, 8, 25],
            [-28, 35, -23],
            [36, 60, 24],
            [32, 91, 10],
          ].map(([x, y, angle], index) => (
            <g key={index} transform={`translate(${x} ${y}) rotate(${angle}) scale(.65)`}>
              <path
                d={
                  species === 'pothos'
                    ? heart
                    : 'M0-9 9 0 24-3 18 11 22 23 8 22 0 35-8 22-22 23-17 10-24-3-9 0Z'
                }
                fill={index % 2 ? light : leaf}
              />
              <path d="M0 0V25" stroke={stem} strokeWidth="1.5" />
            </g>
          ))}
        </>
      ) : species === 'succulent' ? (
        <g>
          {[-76, -48, -20, 12, 40, 71].map((angle, index) => (
            <path
              key={angle}
              d="M0-26Q-26-51-17-84 9-80 13-52L0-26Z"
              transform={`rotate(${angle} 0 -26)`}
              fill={index % 2 ? light : leaf}
              stroke={mask ? '#000' : '#9db19a'}
              strokeWidth="1.4"
            />
          ))}
          <path d="M-13-26Q-20-48 0-65Q23-48 12-26Z" fill={mask ? '#000' : '#9bb59a'} />
        </g>
      ) : species === 'snake' ? (
        <>
          <path d="M-16-24Q-31-89-32-171-7-130-6-24Z M-4-24-2-192Q19-124 9-24Z M11-24Q21-110 36-158 38-70 23-24Z" />
          <path
            d="M-21-30-27-147M4-30 0-170M18-30 32-140"
            stroke={light}
            strokeWidth="4"
            fill="none"
          />
        </>
      ) : species === 'bonsai' ? (
        <>
          <path
            d="M0-22Q-17-48 8-67T-5-119M5-70Q30-72 39-96M-2-77Q-31-78-39-103"
            fill="none"
            stroke={wood}
            strokeWidth="8"
          />
          {[
            [-37, -108, 25, 13],
            [35, -98, 27, 15],
            [-4, -126, 28, 15],
            [5, -84, 20, 10],
          ].map(([x, y, rx, ry], index) => (
            <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry} fill={index % 2 ? light : leaf} />
          ))}
        </>
      ) : species === 'fern' ? (
        <>
          {[-3, -2, -1, 0, 1, 2, 3].map((index) => {
            const ex = index * 25,
              ey = -118 + Math.abs(index) * 12,
              qx = ex * 0.65,
              qy = -120
            return (
              <g key={index}>
                <path
                  d={`M0-25Q${qx} ${qy} ${ex} ${ey}`}
                  fill="none"
                  stroke={stem}
                  strokeWidth="2"
                />
                {[0.2, 0.4, 0.6, 0.8].map((t) => {
                  const x = 2 * (1 - t) * t * qx + t * t * ex,
                    y = (1 - t) * (1 - t) * -25 + 2 * (1 - t) * t * qy + t * t * ey
                  return (
                    <path
                      key={t}
                      d={`M${x} ${y}q-8-11-18-10 5 12 18 13m0-3q8-11 18-10-5 12-18 13`}
                      fill={index % 2 ? light : leaf}
                    />
                  )
                })}
              </g>
            )
          })}
        </>
      ) : species === 'moss' ? (
        <>
          {[
            [-29, -32],
            [-14, -43],
            [5, -39],
            [23, -44],
            [36, -32],
          ].map(([x, y], index) => (
            <ellipse key={index} cx={x} cy={y} rx="17" ry="13" fill={index % 2 ? light : leaf} />
          ))}
          <path
            d="M-26-43l5-4m27 0 5-2m17 10 5-3"
            stroke={mask ? '#000' : '#a2ad7c'}
            strokeWidth="2"
          />
        </>
      ) : species === 'grass' ? (
        <>
          {[-3, -2, -1, 0, 1, 2, 3].map((index) => {
            const x = index * 14,
              y = -155 + (Math.abs(index) % 2) * 29
            return (
              <g key={index}>
                <path
                  d={`M0-23Q${x * 0.4} ${y + 48} ${x} ${y}Q${x + 8} ${y + 43} 4-23Z`}
                  fill={index % 2 ? light : leaf}
                />
                {index % 2 === 0 && <path d={`M${x} ${y}v-18`} stroke={stem} strokeWidth="2" />}
                {index % 2 === 0 && (
                  <ellipse cx={x} cy={y - 21} rx="3" ry="9" fill={mask ? '#000' : '#a69e73'} />
                )}
              </g>
            )
          })}
        </>
      ) : species === 'olive' || species === 'rosemary' ? (
        <>
          <path
            d={
              species === 'olive'
                ? 'M0-24Q6-78 0-167M0-73-28-121M3-98 32-145'
                : 'M0-24-17-105M0-24 5-120M0-24 29-100'
            }
            stroke={wood}
            strokeWidth={species === 'olive' ? 4 : 2.5}
            fill="none"
          />
          {(species === 'olive'
            ? [
                [-3, -151],
                [18, -128],
                [-18, -108],
                [2, -90],
                [23, -151],
                [-29, -123],
              ]
            : [
                [-12, -62],
                [-16, -86],
                [5, -97],
                [4, -67],
                [22, -77],
                [28, -99],
              ]
          ).map(([x, y], index) => (
            <g key={index}>
              <path
                d={`M${x} ${y}q-18-17-27-12 12 13 27 12m0 0q12-20 24-17-9 16-24 17`}
                fill={index % 2 ? light : leaf}
              />
            </g>
          ))}
        </>
      ) : species === 'bamboo' ? (
        <>
          {[-21, 0, 22].map((x, index) => (
            <g key={x}>
              <path d={`M${x} -24V${-158 - (index % 2) * 38}`} stroke={stem} strokeWidth="6" />
              {[-53, -89, -126].map((y) => (
                <g key={y}>
                  <path d={`M${x - 4} ${y}h8`} stroke={light} strokeWidth="2" />
                  <path
                    d={`M${x} ${y - 3}q20-30 42-25-25 23-42 25m0 0q-18-25-38-24 17 22 38 24`}
                    fill={index % 2 ? light : leaf}
                  />
                </g>
              ))}
            </g>
          ))}
        </>
      ) : (
        <>
          <path
            d="M0-24Q-6-70 4-144M0-68-34-112M2-88 37-129M0-112-20-155"
            fill="none"
            stroke={wood}
            strokeWidth="4"
          />
          {species === 'camellia' &&
            [
              [-24, -89],
              [29, -111],
              [-5, -145],
              [13, -64],
              [-35, -120],
              [37, -139],
            ].map(([x, y], index) => (
              <ellipse
                key={index}
                cx={x}
                cy={y}
                rx="16"
                ry="9"
                transform={`rotate(${index % 2 ? 25 : -25} ${x} ${y})`}
              />
            ))}
          {[
            [-34, -112],
            [37, -129],
            [-20, -155],
          ].map(([x, y], index) => (
            <g key={index} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map((angle) => (
                <ellipse
                  key={angle}
                  cy="-5"
                  rx={species === 'camellia' ? 6 : 4}
                  ry={species === 'camellia' ? 8 : 5}
                  transform={`rotate(${angle})`}
                  fill={mask ? '#000' : species === 'camellia' ? '#b78b86' : '#d7c1ac'}
                />
              ))}
              <circle r="2.5" fill={mask ? '#000' : '#d6bc7d'} />
            </g>
          ))}
        </>
      )}
    </g>
  )
}
function Container({ kind, mask }: { kind: ScenePlant['container']; mask: boolean }) {
  const color = mask
    ? '#000'
    : {
        terracotta: '#9d7757',
        ceramic: '#a7afa0',
        brass: '#a18b5b',
        basket: '#8c7753',
        stone: '#7a887d',
        glass: '#789e94',
        wood: '#73694d',
      }[kind]
  const edge = mask ? '#000' : '#c0b594'
  return (
    <g fill={color} stroke={mask ? '#000' : '#5a6452'} strokeWidth="1.5">
      {kind === 'stone' ? (
        <path d="M-37-25H37L29-6Q0 5-29-6Z" />
      ) : kind === 'glass' ? (
        <>
          <path d="M-18-46H18L23-7Q0 5-23-7Z" opacity={mask ? 1 : 0.55} />
          <path d="M-19-28h38" stroke={edge} opacity={mask ? 1 : 0.5} />
        </>
      ) : kind === 'basket' || kind === 'wood' ? (
        <>
          <path d="M-29-32H29L25-3H-25Z" />
          {kind === 'basket' ? (
            <path
              d="M-24-26 20-6m-33-23 37 17m-45 3 37-20M-2-6l28-17"
              fill="none"
              stroke={edge}
              opacity={mask ? 1 : 0.4}
            />
          ) : (
            <path d="M-26-22h52m-51 10h50" stroke={edge} opacity={mask ? 1 : 0.3} />
          )}
        </>
      ) : kind === 'brass' ? (
        <>
          <path d="M-23-35H23V-7Q0 5-23-7Z" />
          <path d="M-16-29v23" stroke={edge} strokeWidth="4" opacity={mask ? 1 : 0.4} />
        </>
      ) : kind === 'ceramic' ? (
        <path d="M-25-32H25L27-12Q25 1 0 0-25 1-27-12Z" />
      ) : (
        <path d="M-28-33H28L21-2H-21Z" />
      )}
      <ellipse
        cy={kind === 'glass' ? -46 : kind === 'stone' ? -25 : kind === 'brass' ? -35 : -32}
        rx={kind === 'stone' ? 35 : kind === 'glass' ? 18 : 26}
        ry="4"
        fill={mask ? '#000' : '#394c39'}
        stroke="none"
      />
    </g>
  )
}
export default function ScenePlants({
  background,
  mask = false,
}: {
  background: Background
  mask?: boolean
}) {
  return (
    <g className={mask ? undefined : 'scene-plants'} aria-hidden="true">
      {getScenePlants(background).map((plant, index) => {
        const mount = (plant.mountX! - plant.x) / plant.scale,
          hook = (plant.mountY! - plant.y) / plant.scale
        return (
          <g
            key={index}
            transform={`translate(${plant.x} ${plant.y}) scale(${plant.scale})`}
            data-plant-species={mask ? undefined : plant.species}
            data-plant-support={mask ? undefined : plant.support}
            data-plant-container={mask ? undefined : plant.container}
          >
            {plant.support === 'stand' ? (
              <g
                fill={mask ? '#000' : '#80765a'}
                stroke={mask ? '#000' : '#5d6550'}
                strokeWidth="3"
              >
                <path d="M-40 0H40v5H-40Z" />
                <path
                  d={`M-28 5V${(plant.floorY! - plant.y) / plant.scale}M28 5V${(plant.floorY! - plant.y) / plant.scale}`}
                  fill="none"
                  strokeWidth="5"
                />
                <path
                  d={`M-28 ${((plant.floorY! - plant.y) / plant.scale) * 0.7}H28`}
                  fill="none"
                />
                <ellipse
                  cy={(plant.floorY! - plant.y) / plant.scale + 3}
                  rx="39"
                  ry="5"
                  fill={mask ? '#000' : '#17251b'}
                  stroke="none"
                  opacity={mask ? 1 : 0.25}
                />
              </g>
            ) : plant.support === 'floor' ? (
              <ellipse
                cy="3"
                rx="38"
                ry="6"
                fill={mask ? '#000' : '#14251c'}
                opacity={mask ? 1 : 0.3}
              />
            ) : plant.support === 'shelf' ? (
              <g
                fill={mask ? '#000' : '#8d8060'}
                stroke={mask ? '#000' : '#756c51'}
                strokeWidth="3"
              >
                <path
                  d={`M${Math.min(-42, mount)} 0H${Math.max(42, mount)}v5H${Math.min(-42, mount)}Z`}
                />
                <path d={`M${mount} 5v29l${mount < 0 ? 31 : -31}-29`} fill="none" />
              </g>
            ) : (
              <g fill="none" stroke={mask ? '#000' : '#b0a382'} strokeWidth={mask ? 4 : 2.5}>
                <circle cy={hook} r="5" />
                <path d={`M0 ${hook + 5}L-24-32M0 ${hook + 5}L24-32`} />
              </g>
            )}
            <Foliage species={plant.species} mask={mask} />
            <Container kind={plant.container} mask={mask} />
          </g>
        )
      })}
    </g>
  )
}
