import { createContext, useContext, useId } from 'react'
export type PremiumInteriorProfile = {
  wall: string
  floor: string
  table: string
  lamp: string
  occupation: string
  wardrobe: string
  hair: string
}
export const PREMIUM_INTERIORS: Record<string, PremiumInteriorProfile> = {
  'premium-christmas-bookcafe': {
    wall: 'brick',
    floor: 'parquet',
    table: 'carved',
    lamp: 'candle',
    occupation: 'bookseller',
    wardrobe: 'burgundy',
    hair: 'braid',
  },
  'premium-halloween-greenhouse': {
    wall: 'iron',
    floor: 'tile',
    table: 'root',
    lamp: 'pumpkin',
    occupation: 'botanist',
    wardrobe: 'moss',
    hair: 'bun',
  },
  'premium-sakura-teahouse': {
    wall: 'paper',
    floor: 'tatami',
    table: 'lacquer',
    lamp: 'paper',
    occupation: 'tea-host',
    wardrobe: 'indigo',
    hair: 'bun',
  },
  'premium-autumn-lake': {
    wall: 'plaster',
    floor: 'boards',
    table: 'slab',
    lamp: 'copper',
    occupation: 'poet',
    wardrobe: 'ochre',
    hair: 'waves',
  },
  'premium-newyear-attic': {
    wall: 'beams',
    floor: 'herringbone',
    table: 'trestle',
    lamp: 'desk',
    occupation: 'composer',
    wardrobe: 'navy',
    hair: 'curly',
  },
  'premium-orient-express': {
    wall: 'panel',
    floor: 'carpet',
    table: 'marquetry',
    lamp: 'sconce',
    occupation: 'conductor',
    wardrobe: 'navy',
    hair: 'short',
  },
  'premium-treetop-house': {
    wall: 'timber',
    floor: 'boards',
    table: 'root',
    lamp: 'cage',
    occupation: 'naturalist',
    wardrobe: 'moss',
    hair: 'ponytail',
  },
  'premium-storm-lighthouse': {
    wall: 'stone',
    floor: 'flagstone',
    table: 'pedestal',
    lamp: 'nautical',
    occupation: 'keeper',
    wardrobe: 'ochre',
    hair: 'beard',
  },
  'premium-canal-houseboat': {
    wall: 'painted',
    floor: 'boards',
    table: 'folding',
    lamp: 'porthole',
    occupation: 'cartographer',
    wardrobe: 'teal',
    hair: 'bob',
  },
  'premium-cloud-airship': {
    wall: 'rivets',
    floor: 'metal',
    table: 'wing',
    lamp: 'industrial',
    occupation: 'navigator',
    wardrobe: 'sand',
    hair: 'short',
  },
  'premium-wizard-library': {
    wall: 'gothic',
    floor: 'carpet',
    table: 'scroll',
    lamp: 'candelabra',
    occupation: 'archivist',
    wardrobe: 'violet',
    hair: 'long',
  },
  'premium-dragon-study': {
    wall: 'stone',
    floor: 'flagstone',
    table: 'claw',
    lamp: 'brazier',
    occupation: 'dragon-keeper',
    wardrobe: 'burgundy',
    hair: 'braid',
  },
  'premium-mushroom-teahouse': {
    wall: 'organic',
    floor: 'mosaic',
    table: 'mushroom',
    lamp: 'spore',
    occupation: 'forager',
    wardrobe: 'moss',
    hair: 'curly',
  },
  'premium-moon-alchemy': {
    wall: 'tile',
    floor: 'mosaic',
    table: 'stone',
    lamp: 'moon',
    occupation: 'alchemist',
    wardrobe: 'teal',
    hair: 'bun',
  },
  'premium-spirit-tree': {
    wall: 'bark',
    floor: 'roots',
    table: 'root',
    lamp: 'seed',
    occupation: 'storyteller',
    wardrobe: 'sand',
    hair: 'long',
  },
  'premium-neon-loft': {
    wall: 'concrete',
    floor: 'metal',
    table: 'cantilever',
    lamp: 'tube',
    occupation: 'designer',
    wardrobe: 'violet',
    hair: 'shaved',
  },
  'premium-midnight-jazz': {
    wall: 'acoustic',
    floor: 'parquet',
    table: 'piano',
    lamp: 'spot',
    occupation: 'pianist',
    wardrobe: 'burgundy',
    hair: 'curly',
  },
  'premium-museum-studio': {
    wall: 'plaster',
    floor: 'tile',
    table: 'easel',
    lamp: 'gallery',
    occupation: 'painter',
    wardrobe: 'sand',
    hair: 'ponytail',
  },
  'premium-last-bookstore': {
    wall: 'panel',
    floor: 'herringbone',
    table: 'drawer',
    lamp: 'banker',
    occupation: 'restorer',
    wardrobe: 'moss',
    hair: 'beard',
  },
  'premium-rooftop-cinema': {
    wall: 'concrete',
    floor: 'deck',
    table: 'folding',
    lamp: 'festoon',
    occupation: 'projectionist',
    wardrobe: 'navy',
    hair: 'bob',
  },
  'premium-waterfall-study': {
    wall: 'stone',
    floor: 'flagstone',
    table: 'stone',
    lamp: 'cascade',
    occupation: 'researcher',
    wardrobe: 'teal',
    hair: 'braid',
  },
  'premium-underwater-library': {
    wall: 'rivets',
    floor: 'mosaic',
    table: 'porthole',
    lamp: 'jelly',
    occupation: 'marine-scholar',
    wardrobe: 'navy',
    hair: 'bob',
  },
  'premium-rain-garden-dome': {
    wall: 'lattice',
    floor: 'tile',
    table: 'petal',
    lamp: 'globe',
    occupation: 'horticulturist',
    wardrobe: 'moss',
    hair: 'bun',
  },
  'premium-desert-rain': {
    wall: 'adobe',
    floor: 'mosaic',
    table: 'brass',
    lamp: 'pierced',
    occupation: 'traveler',
    wardrobe: 'ochre',
    hair: 'wrapped',
  },
  'premium-onsen-veranda': {
    wall: 'timber',
    floor: 'deck',
    table: 'cedar',
    lamp: 'andon',
    occupation: 'innkeeper',
    wardrobe: 'indigo',
    hair: 'bun',
  },
  'premium-observatory': {
    wall: 'gothic',
    floor: 'metal',
    table: 'orbital',
    lamp: 'star',
    occupation: 'astronomer',
    wardrobe: 'navy',
    hair: 'beard',
  },
  'premium-moon-base': {
    wall: 'rivets',
    floor: 'metal',
    table: 'console',
    lamp: 'strip',
    occupation: 'engineer',
    wardrobe: 'teal',
    hair: 'shaved',
  },
  'premium-cloud-post': {
    wall: 'painted',
    floor: 'herringbone',
    table: 'pigeonhole',
    lamp: 'bell',
    occupation: 'postmaster',
    wardrobe: 'burgundy',
    hair: 'bob',
  },
  'premium-personal-roastery': {
    wall: 'brick',
    floor: 'tile',
    table: 'counter',
    lamp: 'copper',
    occupation: 'roaster',
    wardrobe: 'sand',
    hair: 'short',
  },
  'premium-memory-house': {
    wall: 'wallpaper',
    floor: 'parquet',
    table: 'heirloom',
    lamp: 'pleated',
    occupation: 'elder',
    wardrobe: 'ochre',
    hair: 'waves',
  },
}
const InteriorContext = createContext<PremiumInteriorProfile>(
  PREMIUM_INTERIORS['premium-christmas-bookcafe']!,
)
export const PremiumInteriorProvider = InteriorContext.Provider
export const usePremiumInterior = () => useContext(InteriorContext)
export function PremiumMaterials({ spaceId, opening }: { spaceId: string; opening: string }) {
  const uid = useId().replace(/:/g, '')
  const p = PREMIUM_INTERIORS[spaceId]!
  const masonry = ['brick', 'stone', 'adobe'].includes(p.wall),
    vertical = ['panel', 'timber', 'painted', 'bark', 'beams', 'acoustic'].includes(p.wall)
  return (
    <g data-premium-material={p.wall}>
      <defs>
        <mask id={`${uid}-wall`}>
          <path d="M0 0h800v600H0z" fill="white" />
          <path d={opening} fill="black" />
        </mask>
        <pattern
          id={`${uid}-material`}
          width={masonry ? 120 : 80}
          height={masonry ? 52 : 80}
          patternUnits="userSpaceOnUse"
        >
          {masonry ? (
            <path d="M0 1h120M0 51h120M60 0v26M0 26h120M15 26v26" />
          ) : vertical ? (
            <path d="M8 0v80M18 0v80M70 0v80" />
          ) : p.wall === 'rivets' ? (
            <>
              <path d="M0 1h80v79" />
              <circle cx="8" cy="9" r="2" />
              <circle cx="72" cy="71" r="2" />
            </>
          ) : p.wall === 'wallpaper' ? (
            <path d="M40 5q-28 20 0 35 28-15 0-35m0 35q-28 20 0 35 28-15 0-35" />
          ) : p.wall === 'lattice' || p.wall === 'paper' ? (
            <path d="M0 0h80v80H0zM40 0v80M0 40h80" />
          ) : (
            <path d="M4 16q27-14 60 0M10 67q30-12 60 0" />
          )}
        </pattern>
      </defs>
      <path
        d="M0 0h800v600H0z"
        mask={`url(#${uid}-wall)`}
        fill={`url(#${uid}-material)`}
        stroke="#c2ad87"
        strokeWidth="1.5"
        opacity=".15"
      />
      {p.floor === 'carpet' ? (
        <>
          <path d="M85 660 665 637 790 820H0z" fill="#493c43" />
          <path d="M110 679 650 657 745 805H30z" fill="none" stroke="#b29a69" strokeWidth="3" />
          <path d="M125 690 640 670 710 790H58z" fill="none" stroke="#b29a69" opacity=".45" />
        </>
      ) : p.floor === 'mosaic' || p.floor === 'tile' ? (
        <g stroke="#c3ba99" opacity=".2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={i} d={`M${i * 140 - 120} 820 400 590M0 ${630 + i * 30}h800`} />
          ))}
        </g>
      ) : p.floor === 'metal' ? (
        <g fill="none" stroke="#aec2b5" opacity=".17">
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${i * 230} 640l-80 180m10-150h170l-15 90H${i * 230 - 45}z`} />
          ))}
        </g>
      ) : p.floor === 'tatami' ? (
        <g stroke="#c7bd8a" opacity=".35">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${i * 190} 600v220M0 ${625 + i * 42}h800`} />
          ))}
        </g>
      ) : (
        <g stroke="#d2b78b" opacity=".15">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={
                p.floor === 'herringbone' || p.floor === 'parquet'
                  ? `M${i * 155 - 90} 820l150-110-85-65m-65 65 150 110`
                  : `M${i * 155} 610l-65 210`
              }
            />
          ))}
        </g>
      )}
    </g>
  )
}
