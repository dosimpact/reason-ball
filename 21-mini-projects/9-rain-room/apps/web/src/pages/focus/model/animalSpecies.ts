export type AnimalSpecies =
  | 'cat'
  | 'dog'
  | 'deer'
  | 'fox'
  | 'rabbit'
  | 'squirrel'
  | 'owl'
  | 'heron'
  | 'duck'
  | 'gull'
  | 'songbird'
  | 'dragon'
  | 'fish'
  | 'bat'
  | 'spider'
  | 'moth'
  | 'butterfly'
  | 'snail'
  | 'camel'
  | 'jellyfish'
  | 'ray'
  | 'firefly'
export type AnimalDomain = 'ground' | 'perch' | 'air' | 'water'
export type AnimalAction =
  | 'rest'
  | 'sit'
  | 'play'
  | 'sleep'
  | 'eat'
  | 'walk'
  | 'hop'
  | 'fly'
  | 'swim'
  | 'observe'
  | 'groom'
  | 'stretch'
  | 'greet'
  | 'sniff'
  | 'nuzzle'
  | 'headbump'
  | 'yield'
export type AnimalEmotion = 'calm' | 'curious' | 'content' | 'startled' | 'sleepy'
export type SpeciesTraits = {
  speed: number
  socialReach: number
  footprint: { halfWidth: number; halfDepth: number }
  visualEnvelope: { halfWidth: number; above: number; below: number }
  temperament: 'social' | 'gentle' | 'solitary' | 'schooling'
  domains: readonly AnimalDomain[]
  actions: readonly AnimalAction[]
  socialWith: readonly AnimalSpecies[]
  needDrift: { hunger: number; fatigue: number; social: number; curiosity: number }
}
const traits = (
  speed: number,
  width: number,
  depth: number,
  temperament: SpeciesTraits['temperament'],
  domains: AnimalDomain[],
  movement: AnimalAction,
  socialWith: AnimalSpecies[] = [],
): SpeciesTraits => ({
  speed,
  socialReach: width,
  footprint: { halfWidth: width, halfDepth: depth },
  visualEnvelope: { halfWidth: width, above: depth, below: depth },
  temperament,
  domains,
  actions: [
    'rest',
    'sleep',
    'eat',
    'observe',
    'groom',
    'stretch',
    'yield',
    movement,
    ...(domains.includes('water') ? (['swim'] as AnimalAction[]) : []),
    ...(domains.includes('perch') ? (['hop'] as AnimalAction[]) : []),
    ...(socialWith.length
      ? (['greet', 'sniff', 'nuzzle', 'headbump', 'yield'] as AnimalAction[])
      : []),
  ],
  socialWith,
  needDrift: {
    hunger: 0.0014,
    fatigue: 0.001,
    social: temperament === 'social' ? 0.002 : 0.0005,
    curiosity: 0.0013,
  },
})
export const ANIMAL_SPECIES: Record<AnimalSpecies, SpeciesTraits> = {
  cat: {
    ...traits(9, 38, 7, 'social', ['ground', 'perch'], 'walk', ['cat', 'dog']),
    socialReach: 52,
  },
  dog: {
    ...traits(10, 45, 9, 'social', ['ground', 'perch'], 'walk', ['cat', 'dog']),
    socialReach: 67,
  },
  deer: traits(8, 35, 6, 'gentle', ['ground'], 'walk', ['deer']),
  fox: traits(10, 38, 6, 'solitary', ['ground'], 'walk', ['fox']),
  rabbit: { ...traits(11, 24, 6, 'social', ['ground'], 'hop', ['rabbit']), socialReach: 41 },
  squirrel: {
    ...traits(13, 23, 5, 'social', ['ground', 'perch'], 'hop', ['squirrel']),
    socialReach: 41,
  },
  owl: traits(5, 23, 5, 'solitary', ['perch', 'air'], 'fly'),
  heron: traits(6, 25, 5, 'solitary', ['ground', 'water'], 'walk'),
  duck: { ...traits(9, 30, 8, 'social', ['water', 'ground'], 'swim', ['duck']), socialReach: 58 },
  gull: traits(12, 29, 6, 'social', ['perch', 'air', 'water'], 'fly', ['gull']),
  songbird: traits(12, 19, 4, 'social', ['perch', 'air', 'ground'], 'hop', ['songbird']),
  dragon: {
    ...traits(0, 170, 35, 'solitary', ['ground'], 'rest'),
    actions: ['rest', 'sleep', 'observe', 'stretch'],
  },
  fish: {
    ...traits(14, 54, 20, 'schooling', ['water'], 'swim', ['fish']),
    actions: ['rest', 'eat', 'observe', 'swim', 'greet', 'yield'],
  },
  bat: traits(17, 18, 12, 'social', ['air', 'perch'], 'fly', ['bat']),
  spider: traits(3, 10, 8, 'solitary', ['air', 'perch'], 'walk'),
  firefly: {
    ...traits(4, 20, 16, 'gentle', ['air'], 'fly'),
    actions: ['rest', 'sleep', 'observe', 'fly', 'yield'],
  },
  moth: traits(10, 38, 32, 'solitary', ['air'], 'fly'),
  butterfly: traits(11, 38, 32, 'solitary', ['air'], 'fly'),
  snail: traits(1.4, 23, 5, 'solitary', ['ground'], 'walk'),
  camel: traits(6, 35, 6, 'gentle', ['ground'], 'walk', ['camel']),
  jellyfish: {
    ...traits(5, 24, 45, 'solitary', ['water'], 'swim'),
    actions: ['rest', 'eat', 'observe', 'swim', 'yield'],
  },
  ray: {
    ...traits(9, 55, 56, 'solitary', ['water'], 'swim'),
    actions: ['rest', 'eat', 'observe', 'swim', 'yield'],
  },
}

// Only domestic pets have these supported daily-life poses.
ANIMAL_SPECIES.cat.actions = [...ANIMAL_SPECIES.cat.actions, 'sit', 'play']
ANIMAL_SPECIES.dog.actions = [...ANIMAL_SPECIES.dog.actions, 'sit', 'play']

// Conservative extrema of the authored rig, including wings/stroke and both headings.
const bodyEnvelopes: Partial<Record<AnimalSpecies, SpeciesTraits['visualEnvelope']>> = {
  gull: { halfWidth: 66, above: 76, below: 11 },
  owl: { halfWidth: 62, above: 91, below: 6 },
  heron: { halfWidth: 84, above: 106, below: 3 },
  duck: { halfWidth: 58, above: 51, below: 11 },
  songbird: { halfWidth: 44, above: 63, below: 5 },
  bat: { halfWidth: 73, above: 91, below: 5 },
  spider: { halfWidth: 33, above: 30, below: 18 },
  moth: { halfWidth: 40, above: 46, below: 24 },
  butterfly: { halfWidth: 39, above: 46, below: 27 },
  firefly: { halfWidth: 24, above: 17, below: 19 },
  fish: { halfWidth: 56, above: 28, below: 24 },
  ray: { halfWidth: 72, above: 35, below: 69 },
  jellyfish: { halfWidth: 32, above: 42, below: 52 },
}
for (const [species, envelope] of Object.entries(bodyEnvelopes))
  ANIMAL_SPECIES[species as AnimalSpecies].visualEnvelope = envelope!
ANIMAL_SPECIES.firefly.socialWith = ['firefly']
ANIMAL_SPECIES.firefly.socialReach = 26
ANIMAL_SPECIES.firefly.actions = ['rest', 'observe', 'fly', 'greet', 'yield']

/** Mouth contact in the frozen eating rig, in unscaled local coordinates. */
export const ANIMAL_FEEDING_OFFSET: Record<AnimalSpecies, { x: number; y: number }> = {
  cat: { x: 41, y: 0 },
  dog: { x: 54, y: 0 },
  fox: { x: 53, y: 0 },
  rabbit: { x: 30, y: 0 },
  squirrel: { x: 30, y: 0 },
  deer: { x: 80, y: 0 },
  camel: { x: 80, y: 0 },
  duck: { x: 52, y: 0 },
  gull: { x: 49, y: 0 },
  songbird: { x: 37, y: 0 },
  heron: { x: 81, y: 0 },
  owl: { x: 16, y: 0 },
  fish: { x: 36, y: 0 },
  snail: { x: 32, y: 0 },
  firefly: { x: 0, y: 0 },
  ray: { x: 0, y: 10 },
  jellyfish: { x: 0, y: 48 },
  dragon: { x: 0, y: 0 },
  bat: { x: 0, y: 0 },
  spider: { x: 0, y: 0 },
  moth: { x: 0, y: 0 },
  butterfly: { x: 0, y: 0 },
}
