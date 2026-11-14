import test from 'node:test'
import assert from 'node:assert/strict'
import {
  receiptPaperFrame,
  paperFeedFraction,
  PRINT_DURATION_MS,
  PAPER_FEED_START_MS,
  PAPER_FEED_END_MS,
  PAPER_FEED_CUE_TIMES_MS,
  RECEIPT_PAPER_BANDS,
} from '../src/pages/focus/lib/receiptPaper.ts'
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const layout = { top: 24, bottom: 640, height: 592 }
test('feed is pulsed and monotonic in the same window as the mechanical cues', () => {
  assert.equal(paperFeedFraction((PAPER_FEED_START_MS - 1) / PRINT_DURATION_MS), 0)
  assert.equal(paperFeedFraction(PAPER_FEED_END_MS / PRINT_DURATION_MS), 1)
  let previous = 0
  for (let ms = 0; ms <= PRINT_DURATION_MS; ms += 5) {
    const feed = paperFeedFraction(ms / PRINT_DURATION_MS)
    assert.ok(feed >= previous && feed <= 1)
    previous = feed
  }
  assert.equal(PAPER_FEED_CUE_TIMES_MS.length, 5)
  close(paperFeedFraction(780 / PRINT_DURATION_MS), paperFeedFraction(810 / PRINT_DURATION_MS))
})
test('a real expanding-radius roll feeds upward with its flat tail attached until final delivery', () => {
  const start = receiptPaperFrame(0, layout)
  close(start.leadingY, layout.bottom)
  const early = receiptPaperFrame(850 / PRINT_DURATION_MS, layout)
  const middle = receiptPaperFrame(1600 / PRINT_DURATION_MS, layout)
  assert.ok(early.winding > 1 && middle.winding > 1, 'paper actually turns more than360degrees')
  assert.ok(middle.leadingY < early.leadingY && early.leadingY < layout.bottom)
  for (let ms = PAPER_FEED_START_MS; ms <= PAPER_FEED_END_MS; ms += 5) {
    const frame = receiptPaperFrame(ms / PRINT_DURATION_MS, layout)
    if (frame.tailAnchored) close(frame.edge.y, layout.bottom)
    close(frame.edge.z, 0)
    assert.ok(
      frame.vertices.every((v) => v.z <= 1e-8),
      'roll stays behind its final plane, avoiding viewport magnification',
    )
    assert.ok(frame.bands.length <= 48)
    const visible = frame.bands.filter((band) => band.visible)
    close(
      visible.reduce((sum, band) => sum + band.sourceHeight, 0),
      frame.visibleLength,
    )
    for (let i = 0; i < frame.bands.length; i++) {
      const band = frame.bands[i],
        next = frame.vertices[i + 1]
      for (const n of [band.y, band.z, band.rotation, band.height, band.sourceY, band.shade])
        assert.ok(Number.isFinite(n))
      assert.ok(band.shade >= 0 && band.shade <= 0.3)
      const angle = (band.rotation * Math.PI) / 180
      close(next.y, band.y + band.height * Math.cos(angle))
      close(next.z, band.z + band.height * Math.sin(angle))
      if (i) close(band.sourceY, frame.bands[i - 1].sourceY + frame.bands[i - 1].sourceHeight)
    }
  }
  assert.ok(early.bands.some((b) => b.backVisible))
  assert.ok(early.bands.some((b) => b.z < -10))
})

test('coiled centerline never crosses itself and has distinct inner and outer turns', () => {
  const cross = (a, b, c) => (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)
  for (const target of [
    layout,
    { top: 16, bottom: 375, height: 327 },
    { top: 92, bottom: 844, height: 664 },
  ]) {
    for (let ms = 355; ms <= 2700; ms += 10) {
      const frame = receiptPaperFrame(ms / PRINT_DURATION_MS, target)
      const points = frame.vertices
      for (let i = 0; i < points.length - 1; i++)
        for (let j = i + 2; j < points.length - 1; j++) {
          const a = points[i],
            b = points[i + 1],
            c = points[j],
            d = points[j + 1]
          const crosses =
            cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10
          assert.equal(crosses, false, `no self-intersection at ${ms}ms bands${i}/${j}`)
        }
    }
  }
  const roll = receiptPaperFrame(1600 / PRINT_DURATION_MS, layout)
  const turns = roll.bands.filter((b) => b.rotation > 360)
  assert.ok(turns.length > 0)
  assert.ok(
    new Set(roll.bands.filter((b) => b.visible).map((b) => Math.round(b.z))).size > 15,
    'the roll is real depth geometry, not a flat stripe',
  )
})
test('feed ends at exact final receipt bounds with no second lift or scale phase', () => {
  const end = receiptPaperFrame(PAPER_FEED_END_MS / PRINT_DURATION_MS, layout)
  const final = receiptPaperFrame(1, layout)
  assert.equal(final.phase, 'complete')
  assert.equal(final.bands.length, RECEIPT_PAPER_BANDS)
  assert.deepEqual(
    end.bands,
    final.bands,
    'after feeding only the callback wait remains; the paper does not jump again',
  )
  for (const band of final.bands) {
    assert.equal(band.visible, true)
    close(band.rotation, 0)
    close(band.shade, 0)
    close(band.z, 0)
    close(band.y, layout.top + (band.index * layout.height) / RECEIPT_PAPER_BANDS)
  }
  close(final.edge.y, layout.top + layout.height)
})
