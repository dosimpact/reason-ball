import type { Session } from './timer.ts'

export type Temperature = 'hot' | 'iced'
export const DRINKS = [
  {
    id: 'americano',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#5e3e2a', cream: '#b18c5b', accent: '#9a6b43' },
  },
  {
    id: 'cafe-latte',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#b18a61', cream: '#eee2c5', accent: '#a17852' },
  },
  {
    id: 'vanilla-latte',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#c5a778', cream: '#f1e5c8', accent: '#d3b47a' },
  },
  {
    id: 'cappuccino',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#ac8059', cream: '#eae0cb', accent: '#a17c54' },
  },
  {
    id: 'cafe-mocha',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#79513b', cream: '#dfcfb4', accent: '#664332' },
  },
  {
    id: 'caramel-macchiato',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#b5824e', cream: '#efe0c0', accent: '#be8c4e' },
  },
  {
    id: 'cold-brew',
    temperatures: ['iced'],
    colors: { liquid: '#4c342b', cream: '#ad926f', accent: '#79553b' },
  },
  {
    id: 'decaf-americano',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#6d4d35', cream: '#b89e76', accent: '#8e754e' },
  },
  {
    id: 'matcha-latte',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#87946b', cream: '#e4dfc1', accent: '#6e8055' },
  },
  {
    id: 'hot-chocolate',
    temperatures: ['hot', 'iced'],
    colors: { liquid: '#715040', cream: '#e5d6bf', accent: '#8e6550' },
  },
] as const
export type DrinkId = (typeof DRINKS)[number]['id']
export function getDrink(id?: unknown): (typeof DRINKS)[number] {
  return DRINKS.find((drink) => drink.id === id) ?? DRINKS[0]
}
export type CafeOrder = {
  id: string
  drinkId: DrinkId
  temperature: Temperature
  createdAt: number
}
export type RitualState = {
  stage:
    | 'menu'
    | 'checkout'
    | 'printing'
    | 'receipt'
    | 'seating'
    | 'room'
    | 'leaving'
    | 'coupon'
    | 'break'
  drinkId: DrinkId
  temperature: Temperature
  order: CafeOrder | null
}
export type RitualEvent =
  | { type: 'selectdrink'; drinkId: DrinkId }
  | { type: 'temperature'; temperature: Temperature }
  | { type: 'order'; order: CafeOrder }
  | {
      type:
        | 'checkout'
        | 'back'
        | 'printed'
        | 'seat'
        | 'ready'
        | 'fail'
        | 'reorder'
        | 'finish'
        | 'left'
        | 'startrest'
    }

const isDrinkId = (id: unknown): id is DrinkId => DRINKS.some((drink) => drink.id === id)
const allowed = (id: DrinkId, temperature: unknown): temperature is Temperature =>
  (getDrink(id).temperatures as readonly unknown[]).includes(temperature)
const temperatureFor = (id: DrinkId, temperature: unknown): Temperature =>
  allowed(id, temperature) ? temperature : getDrink(id).temperatures[0]
function readOrder(raw: unknown): CafeOrder | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    value.id.length > 128 ||
    value.id !== value.id.trim() ||
    /[\u0000-\u001f]/.test(value.id) ||
    !isDrinkId(value.drinkId) ||
    !allowed(value.drinkId, value.temperature) ||
    !Number.isSafeInteger(value.createdAt) ||
    (value.createdAt as number) < 0
  )
    return null
  return {
    id: value.id,
    drinkId: value.drinkId,
    temperature: value.temperature,
    createdAt: value.createdAt as number,
  }
}
/** Every app load returns to the counter; only a validated drink preference survives. */
export function createRitualState(raw: unknown, _session: Session): RitualState {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const previousOrder = readOrder(value.order)
  const drinkId = isDrinkId(value.drinkId) ? value.drinkId : (previousOrder?.drinkId ?? 'americano')
  const temperature = temperatureFor(
    drinkId,
    value.temperature ??
      (previousOrder?.drinkId === drinkId ? previousOrder.temperature : undefined),
  )
  return { stage: 'menu', drinkId, temperature, order: null }
}
/** Transition guards make duplicate clicks and late animation callbacks harmless. */
export function ritualReducer(state: RitualState, event: RitualEvent): RitualState {
  switch (event.type) {
    case 'selectdrink':
      return state.stage === 'menu' && isDrinkId(event.drinkId)
        ? {
            ...state,
            drinkId: event.drinkId,
            temperature: temperatureFor(event.drinkId, state.temperature),
          }
        : state
    case 'temperature':
      return state.stage === 'menu' && allowed(state.drinkId, event.temperature)
        ? { ...state, temperature: event.temperature }
        : state
    case 'checkout':
      return state.stage === 'menu' ? { ...state, stage: 'checkout' } : state
    case 'back':
      return state.stage === 'checkout' ? { ...state, stage: 'menu' } : state
    case 'order': {
      if (state.stage !== 'checkout') return state
      const order = readOrder(event.order)
      return order && order.drinkId === state.drinkId && order.temperature === state.temperature
        ? { ...state, stage: 'printing', order }
        : state
    }
    case 'printed':
      return state.stage === 'printing' && state.order ? { ...state, stage: 'receipt' } : state
    case 'seat':
      return state.stage === 'receipt' && state.order ? { ...state, stage: 'seating' } : state
    case 'ready':
      return state.stage === 'seating' && state.order ? { ...state, stage: 'room' } : state
    case 'fail':
      return (state.stage === 'printing' || state.stage === 'seating') && state.order
        ? { ...state, stage: 'receipt' }
        : state
    case 'finish':
      return state.stage === 'room' ? { ...state, stage: 'leaving' } : state
    case 'left':
      return state.stage === 'leaving' ? { ...state, stage: 'coupon' } : state
    case 'startrest':
      return state.stage === 'coupon' ? { ...state, stage: 'break' } : state
    case 'reorder':
      return ['room', 'receipt', 'coupon', 'break'].includes(state.stage)
        ? { ...state, stage: 'menu', order: null }
        : state
    default:
      return state
  }
}
