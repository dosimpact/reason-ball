import { useCallback, useEffect, useRef, useState } from 'react'
import { SCENE_INTERACTIVE_OBJECTS } from './sceneInteractiveObjects'
import { emptyObjectCollection, mergeObjectCollections } from './objectCollection'
import {
  LocalObjectCollectionStorage,
  type ObjectCollectionStorage,
} from './objectCollectionStorage'
const knownIds = new Set(SCENE_INTERACTIVE_OBJECTS.map((object) => object.id))
export function useObjectCollection(providedStorage?: ObjectCollectionStorage) {
  const [storage] = useState(() => providedStorage ?? new LocalObjectCollectionStorage())
  const [initial] = useState(() => storage.read())
  const working = useRef(initial.ok ? initial.ledger : emptyObjectCollection())
  const [collected, setCollected] = useState<Readonly<Record<string, number>>>(
    working.current.collected,
  )
  const [storageError, setStorageError] = useState(!initial.ok)
  const [notice, setNotice] = useState<{ objectId: string; serial: number } | null>(null)
  const serial = useRef(0)
  const retrySave = useCallback(() => {
    const result = storage.update((latest) => mergeObjectCollections(latest, working.current))
    setStorageError(!result.ok)
    if (result.ok) {
      working.current = result.ledger
      setCollected(result.ledger.collected)
    }
  }, [storage])
  const discover = useCallback(
    (id: string) => {
      if (!knownIds.has(id)) return false
      const latest = storage.read()
      if (!latest.ok) setStorageError(true)
      if (latest.ok) working.current = mergeObjectCollections(working.current, latest.ledger)
      if (Object.hasOwn(working.current.collected, id)) {
        setCollected(working.current.collected)
        retrySave()
        return false
      }
      working.current = {
        version: 1,
        collected: { ...working.current.collected, [id]: Date.now() },
      }
      setCollected(working.current.collected)
      retrySave()
      setNotice({ objectId: id, serial: ++serial.current })
      return true
    },
    [storage, retrySave],
  )
  const dismissNotice = useCallback(() => setNotice(null), [])
  useEffect(() => storage.subscribe(retrySave), [storage, retrySave])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismissNotice, 3200)
    return () => window.clearTimeout(timer)
  }, [notice, dismissNotice])
  return { collected, notice, storageError, discover, dismissNotice, retrySave }
}
