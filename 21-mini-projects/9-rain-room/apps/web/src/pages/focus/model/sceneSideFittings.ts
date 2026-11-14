/** Side bays occupy the desktop-visible strips beside, never over, the authored core. */
export type SideFitting =
  | 'books'
  | 'cupboard'
  | 'bench'
  | 'planter'
  | 'controls'
  | 'rigging'
  | 'rail'
  | 'lockers'
  | 'luggage'
  | 'art-rack'
  | 'pipes'
  | 'vines'
  | 'tea-shelf'
  | 'instruments'
  | 'bottles'
  | 'letters'
  | 'tools'
  | 'roots'
export type SceneSidePlan = { left: SideFitting; right: SideFitting }
export const SCENE_SIDE_FITTINGS: Record<string, SceneSidePlan> = {
  'cafe-rain': { left: 'books', right: 'cupboard' },
  'cafe-alley': { left: 'books', right: 'bench' },
  'cafe-greenhouse': { left: 'planter', right: 'vines' },
  'cafe-rooftop': { left: 'cupboard', right: 'controls' },
  'cafe-seaside': { left: 'bench', right: 'tea-shelf' },
  'study-fire': { left: 'books', right: 'tools' },
  'study-attic': { left: 'cupboard', right: 'books' },
  'study-library': { left: 'books', right: 'books' },
  'study-city': { left: 'cupboard', right: 'controls' },
  'study-moon': { left: 'books', right: 'bench' },
  'forest-mist': { left: 'vines', right: 'cupboard' },
  'forest-cabin': { left: 'books', right: 'tools' },
  'forest-fireflies': { left: 'vines', right: 'planter' },
  'forest-bamboo': { left: 'tea-shelf', right: 'planter' },
  'forest-autumn': { left: 'bench', right: 'books' },
  'water-moon': { left: 'rail', right: 'planter' },
  'water-lake': { left: 'rail', right: 'rail' },
  'water-stream': { left: 'planter', right: 'bench' },
  'water-harbor': { left: 'rigging', right: 'luggage' },
  'water-falls': { left: 'vines', right: 'planter' },
  'travel-train': { left: 'luggage', right: 'lockers' },
  'travel-tent': { left: 'rigging', right: 'luggage' },
  'travel-van': { left: 'lockers', right: 'cupboard' },
  'travel-lodge': { left: 'books', right: 'bench' },
  'travel-stars': { left: 'controls', right: 'tools' },
  'garden-hanok': { left: 'tea-shelf', right: 'bench' },
  'garden-court': { left: 'bench', right: 'planter' },
  'garden-glass': { left: 'tools', right: 'planter' },
  'garden-lotus': { left: 'tea-shelf', right: 'planter' },
  'garden-snow': { left: 'cupboard', right: 'bench' },
  'study-linen': { left: 'cupboard', right: 'bench' },
  'forest-pine-fireflies': { left: 'books', right: 'vines' },
  'study-granite': { left: 'art-rack', right: 'tools' },
  'water-harbor-deep': { left: 'controls', right: 'rigging' },
  'water-velvet-tide': { left: 'rail', right: 'planter' },
  'cafe-barista-long-table': { left: 'tea-shelf', right: 'cupboard' },
  'cafe-rain-dome': { left: 'planter', right: 'bench' },
  'cafe-neon-night': { left: 'controls', right: 'cupboard' },
  'premium-christmas-bookcafe': { left: 'books', right: 'tea-shelf' },
  'premium-halloween-greenhouse': { left: 'vines', right: 'bottles' },
  'premium-sakura-teahouse': { left: 'tea-shelf', right: 'bench' },
  'premium-autumn-lake': { left: 'books', right: 'bench' },
  'premium-newyear-attic': { left: 'letters', right: 'cupboard' },
  'premium-orient-express': { left: 'luggage', right: 'tea-shelf' },
  'premium-treetop-house': { left: 'roots', right: 'vines' },
  'premium-storm-lighthouse': { left: 'rigging', right: 'controls' },
  'premium-canal-houseboat': { left: 'rigging', right: 'cupboard' },
  'premium-cloud-airship': { left: 'controls', right: 'rigging' },
  'premium-wizard-library': { left: 'books', right: 'bottles' },
  'premium-dragon-study': { left: 'books', right: 'tools' },
  'premium-mushroom-teahouse': { left: 'roots', right: 'tea-shelf' },
  'premium-moon-alchemy': { left: 'bottles', right: 'tools' },
  'premium-spirit-tree': { left: 'roots', right: 'vines' },
  'premium-neon-loft': { left: 'art-rack', right: 'controls' },
  'premium-midnight-jazz': { left: 'instruments', right: 'books' },
  'premium-museum-studio': { left: 'art-rack', right: 'art-rack' },
  'premium-last-bookstore': { left: 'books', right: 'books' },
  'premium-rooftop-cinema': { left: 'rail', right: 'controls' },
  'premium-waterfall-study': { left: 'books', right: 'vines' },
  'premium-underwater-library': { left: 'pipes', right: 'books' },
  'premium-rain-garden-dome': { left: 'planter', right: 'tools' },
  'premium-desert-rain': { left: 'bottles', right: 'bench' },
  'premium-onsen-veranda': { left: 'rail', right: 'tea-shelf' },
  'premium-observatory': { left: 'controls', right: 'tools' },
  'premium-moon-base': { left: 'lockers', right: 'controls' },
  'premium-cloud-post': { left: 'letters', right: 'luggage' },
  'premium-personal-roastery': { left: 'bottles', right: 'tools' },
  'premium-memory-house': { left: 'letters', right: 'cupboard' },
}
