import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRitualState,
  ritualReducer,
  DRINKS,
  getDrink,
  type CafeOrder,
  type RitualState,
} from '../src/pages/focus/model/cafeRitual.ts'
import { fresh, defaults, type Session } from '../src/pages/focus/model/timer.ts'
const idle = () => fresh('focus', defaults)
const order = (
  drinkId: CafeOrder['drinkId'] = 'americano',
  temperature: CafeOrder['temperature'] = 'hot',
): CafeOrder => ({ id: 'order-1', drinkId, temperature, createdAt: 1700000000000 })
const checkout = () => ritualReducer(createRitualState(null, idle()), { type: 'checkout' })
test('all ten drinks complete the same guarded order/receipt/seating path with matching cup snapshots', () => {
  assert.equal(DRINKS.length, 10)
  assert.equal(new Set(DRINKS.map((d) => d.id)).size, 10)
  for (const drink of DRINKS)
    for (const temperature of drink.temperatures) {
      let state = createRitualState(null, idle())
      state = ritualReducer(state, { type: 'selectdrink', drinkId: drink.id })
      state = ritualReducer(state, { type: 'temperature', temperature })
      state = ritualReducer(state, { type: 'checkout' })
      const committed = order(drink.id, temperature)
      state = ritualReducer(state, { type: 'order', order: committed })
      assert.equal(state.stage, 'printing')
      assert.deepEqual(state.order, committed)
      for (const type of ['printed', 'seat', 'ready'] as const)
        state = ritualReducer(state, { type })
      assert.equal(state.stage, 'room')
      assert.equal(state.drinkId, committed.drinkId)
      assert.equal(state.temperature, committed.temperature)
    }
})
test('double order and late transition callbacks are ignored; receipt failure can retry seating', () => {
  const state = ritualReducer(checkout(), { type: 'order', order: order() })
  assert.equal(
    ritualReducer(state, { type: 'order', order: { ...order(), id: 'duplicate' } }),
    state,
  )
  assert.equal(ritualReducer(state, { type: 'back' }), state)
  assert.equal(ritualReducer(state, { type: 'reorder' }), state)
  assert.equal(ritualReducer(state, { type: 'ready' }), state)
  const receipt = ritualReducer(state, { type: 'printed' })
  assert.equal(ritualReducer(receipt, { type: 'printed' }), receipt)
  const seating = ritualReducer(receipt, { type: 'seat' })
  assert.equal(ritualReducer(seating, { type: 'seat' }), seating)
  const failed = ritualReducer(seating, { type: 'fail' })
  assert.equal(failed.stage, 'receipt')
  assert.deepEqual(failed.order, order())
  const room = ritualReducer(ritualReducer(failed, { type: 'seat' }), { type: 'ready' })
  assert.equal(ritualReducer(room, { type: 'ready' }), room)
  const reordered = ritualReducer(room, { type: 'reorder' })
  assert.equal(reordered.stage, 'menu')
  assert.equal(reordered.order, null)
  assert.equal(ritualReducer(reordered, { type: 'ready' }), reordered)
})
test('cold brew cannot become hot, malformed and mismatched committed orders are rejected', () => {
  assert.deepEqual(getDrink('cold-brew').temperatures, ['iced'])
  assert.equal(getDrink('__proto__').id, 'americano')
  let state = ritualReducer(createRitualState(null, idle()), {
    type: 'selectdrink',
    drinkId: 'cold-brew',
  })
  assert.equal(state.temperature, 'iced')
  assert.equal(ritualReducer(state, { type: 'temperature', temperature: 'hot' }), state)
  state = ritualReducer(state, { type: 'checkout' })
  for (const invalid of [
    order(),
    order('cold-brew', 'hot'),
    { ...order('cold-brew', 'iced'), createdAt: NaN },
    { ...order('cold-brew', 'iced'), id: '' },
  ])
    assert.equal(ritualReducer(state, { type: 'order', order: invalid }), state)
})
test('every saved stage and timer status returns to the counter without an order', () => {
  for (const stage of ['menu', 'checkout', 'printing', 'receipt', 'seating', 'room']) {
    for (const status of ['idle', 'running', 'paused', 'complete'] as const) {
      const session: Session = {
        ...idle(),
        status,
        deadline: status === 'running' ? 1700000200000 : null,
      }
      const state = createRitualState(
        {
          stage,
          drinkId: 'matcha-latte',
          temperature: 'iced',
          order: order('matcha-latte', 'iced'),
        },
        session,
      )
      assert.deepEqual(state, {
        stage: 'menu',
        drinkId: 'matcha-latte',
        temperature: 'iced',
        order: null,
      })
      for (const type of ['printed', 'seat', 'ready'] as const)
        assert.equal(ritualReducer(state, { type }), state)
    }
  }
})
test('legacy timers never synthesize a restored cup or bypass a new order', () => {
  for (const status of ['running', 'paused', 'complete'] as const) {
    const session: Session = {
      ...idle(),
      status,
      deadline: status === 'running' ? 1700000200000 : null,
    }
    assert.deepEqual(createRitualState(null, session), {
      stage: 'menu',
      drinkId: 'americano',
      temperature: 'hot',
      order: null,
    })
    const preference = createRitualState(
      { stage: 'room', order: order('cold-brew', 'iced') },
      session,
    )
    assert.deepEqual(preference, {
      stage: 'menu',
      drinkId: 'cold-brew',
      temperature: 'iced',
      order: null,
    })
  }
})
test('bad persisted shapes normalize safely and drafts do not preserve stale committed orders', () => {
  for (const raw of [
    null,
    42,
    [],
    { stage: 'printing' },
    { stage: 'room', order: { ...order(), drinkId: 'missing' } },
    {
      stage: {
        toString: () => {
          throw Error('must not coerce')
        },
      },
    },
  ])
    assert.equal(createRitualState(raw, idle()).stage, 'menu')
  const cold = createRitualState(
    { stage: 'menu', drinkId: 'cold-brew', temperature: 'hot' },
    idle(),
  )
  assert.equal(cold.temperature, 'iced')
  const draft = createRitualState(
    { stage: 'checkout', drinkId: 'vanilla-latte', temperature: 'iced', order: order() },
    idle(),
  )
  assert.equal(draft.order, null)
  assert.equal(draft.drinkId, 'vanilla-latte')
  assert.equal(ritualReducer(draft, { type: 'back' }).stage, 'menu')
})

test('completed visits leave once, offer a coupon then rest, and refresh never restores a reward ceremony', () => {
  let state = createRitualState(null, idle())
  for (const event of [
    { type: 'checkout' },
    { type: 'order', order: order() },
    { type: 'printed' },
    { type: 'seat' },
    { type: 'ready' },
  ] as const)
    state = ritualReducer(state, event)
  assert.equal(state.stage, 'room')
  state = ritualReducer(state, { type: 'finish' })
  assert.equal(state.stage, 'leaving')
  assert.equal(ritualReducer(state, { type: 'finish' }), state)
  assert.equal(ritualReducer(state, { type: 'startrest' }), state)
  state = ritualReducer(state, { type: 'left' })
  assert.equal(state.stage, 'coupon')
  assert.equal(ritualReducer(state, { type: 'left' }), state)
  state = ritualReducer(state, { type: 'startrest' })
  assert.equal(state.stage, 'break')
  assert.equal(ritualReducer(state, { type: 'finish' }), state)
  assert.equal(createRitualState(state, idle()).stage, 'menu')
  assert.equal(ritualReducer(state, { type: 'reorder' }).order, null)
})
