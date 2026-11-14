/** Remove authored living bodies only; preserve their physical supports and exact paint insertion. */
export function extractAnimalSlots(tree, plan) {
  const groups = new Map()
  for (const actor of plan.actors) {
    if (!actor.source) continue
    const node = tree.querySelectorAll(actor.source.selector)[actor.source.index]
    if (!node) continue
    if (!groups.has(node)) groups.set(node, [])
    groups.get(node).push(actor)
  }
  const inserted = []
  for (const [node, actors] of groups) {
    const retained = new Set()
    for (const actor of actors)
      for (const selector of actor.source.supportSelectors ?? [])
        for (const support of node.querySelectorAll(selector)) retained.add(support)
    const support = node.cloneNode(false)
    for (const attribute of [
      'data-pet',
      'data-wildlife',
      'data-premium-animal',
      'data-premium-hero',
      'data-premium-motion',
      'data-motion-kind',
      'class',
      'style',
    ])
      support.removeAttribute(attribute)
    support.setAttribute('data-animal-static-support', 'true')
    for (const child of retained) support.appendChild(child.cloneNode(true))
    if (support.children.length) node.before(support)
    const companions = plan.actors.filter(
      (actor) => !actor.source && actors.some((primary) => primary.zoneId === actor.zoneId),
    )
    for (const actor of [...actors, ...companions]) {
      const slot = tree.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g')
      slot.setAttribute('data-pixi-animal-slot', actor.id)
      if (actor.sourceMotionId) slot.setAttribute('data-animal-source-motion', actor.sourceMotionId)
      // Keep ancestry only: state/home already use global authoring coordinates.
      node.before(slot)
      inserted.push(actor.id)
    }
    node.remove()
  }
  for (const actor of plan.actors)
    if (actor.slotOf)
      for (const auxiliary of tree.querySelectorAll(`[data-premium-motion="${actor.slotOf}"]`))
        auxiliary.remove()
  const livingSelector =
    '[data-pet],[data-wildlife],[data-premium-animal],[data-premium-hero="sleeping-dragon"],.premium-fish,.premium-bat'
  const leftovers = [
    ...tree.querySelectorAll(livingSelector),
    ...tree.querySelectorAll('[data-premium-motion][data-motion-kind]'),
  ].filter(
    (node) =>
      node.matches(livingSelector) ||
      [
        'bird',
        'squirrel',
        'web',
        'moth',
        'butterfly',
        'snail',
        'ray',
        'jelly',
        'caravan',
        'firefly',
      ].includes(node.getAttribute('data-motion-kind')),
  )
  if (leftovers.length)
    throw Error(
      `${plan.id}: unregistered static animal bodies remain (${leftovers.map((node) => node.outerHTML.slice(0, 100)).join('; ')})`,
    )
  return inserted
}
