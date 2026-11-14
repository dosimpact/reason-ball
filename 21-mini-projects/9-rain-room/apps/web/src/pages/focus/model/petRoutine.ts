import type { AnimalAction } from './animalSpecies.ts'

export type PetRoutine = {
  temperament: 'restful' | 'curious' | 'playful'
  actions: readonly AnimalAction[]
  openingIndex: number
  openingDuration: number
  walkChance: number
}
/** Identity and room seed choose a stable daily rhythm, independent of actor array order.
 * Play is a small supported paw/toyless gesture; it never creates a new travel path. */
export function createPetRoutine(id: string, seed: number, species: 'cat' | 'dog'): PetRoutine {
  let hash = seed >>> 0
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  const temperament = (['restful', 'curious', 'playful'] as const)[hash % 3]
  const rhythms: Record<PetRoutine['temperament'], AnimalAction[]> = {
    restful: ['sleep', 'stretch', 'sit', 'groom', 'rest', 'sniff', 'observe', 'play'],
    curious: ['sit', 'sniff', 'observe', 'groom', 'rest', 'play', 'stretch', 'sleep'],
    playful: ['play', 'sit', 'groom', 'sniff', 'rest', 'stretch', 'observe', 'sleep'],
  }
  const actions = rhythms[temperament]
  return {
    temperament,
    actions,
    openingIndex: (hash >>> 8) % actions.length,
    openingDuration: 5 + ((hash >>> 16) % 90) / 10,
    walkChance:
      (temperament === 'restful' ? 0.16 : temperament === 'curious' ? 0.3 : 0.24) +
      (species === 'dog' ? 0.03 : 0),
  }
}
export function petActionDuration(action: AnimalAction, random: number): number {
  const limits: Partial<Record<AnimalAction, readonly [number, number]>> = {
    rest: [18, 32],
    sleep: [28, 48],
    sit: [12, 22],
    observe: [9, 16],
    groom: [7, 12],
    play: [5, 9],
    sniff: [5, 10],
    stretch: [4, 7],
  }
  const [minimum, maximum] = limits[action] ?? [8, 14]
  return minimum + (maximum - minimum) * Math.max(0, Math.min(1, random))
}

/** A weighted bag gives each everyday gesture a turn, but never repeats a
 * clockwork sequence. Needs gently bias the remaining choices, not feeding. */
export function nextPetAction(
  routine: PetRoutine,
  remaining: readonly AnimalAction[],
  previous: AnimalAction,
  needs: { fatigue: number; curiosity: number },
  random: number,
): { action: AnimalAction; remaining: AnimalAction[] } {
  let bag = remaining.length ? [...remaining] : [...routine.actions]
  if (bag.every((action) => action === previous)) bag = [...routine.actions]
  const candidates = bag.filter((action) => action !== previous)
  const weights = candidates.map((action) => {
    let weight = 1
    if (routine.temperament === 'restful' && ['rest', 'sleep', 'sit'].includes(action)) weight = 2
    if (routine.temperament === 'curious' && ['sniff', 'observe'].includes(action)) weight = 2
    if (routine.temperament === 'playful' && ['play', 'stretch'].includes(action)) weight = 2
    if (['sleep', 'rest'].includes(action)) weight *= 1 + needs.fatigue
    if (['sniff', 'observe', 'play'].includes(action)) weight *= 1 + needs.curiosity
    return weight
  })
  let cursor = random * weights.reduce((sum, weight) => sum + weight, 0)
  let selected = candidates.at(-1)!
  for (let i = 0; i < candidates.length; i++) {
    cursor -= weights[i]
    if (cursor <= 0) {
      selected = candidates[i]
      break
    }
  }
  return { action: selected, remaining: bag.filter((action) => action !== selected) }
}
