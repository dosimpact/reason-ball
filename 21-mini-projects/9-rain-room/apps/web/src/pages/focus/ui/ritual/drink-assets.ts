import type { DrinkId } from '../../model/cafeRitual'

// Matte, filled SVG objects use the same cream / sage / earth palette as room cups.
export type DrinkArtwork = {
  shape:
    | 'wide'
    | 'sage-bowl'
    | 'ribbed'
    | 'foam-bowl'
    | 'glass-mug'
    | 'milk-glass'
    | 'tall-glass'
    | 'clay-cup'
    | 'round-glass'
    | 'cocoa-mug'
  body: string
  shade: string
  liquid: string
  cream: string
}
export const DRINK_ARTWORK = {
  americano: {
    shape: 'wide',
    body: '#d8ceaa',
    shade: '#b6ad8f',
    liquid: '#4f4130',
    cream: '#cbbd9a',
  },
  'cafe-latte': {
    shape: 'sage-bowl',
    body: '#8c9a85',
    shade: '#737f6d',
    liquid: '#927b57',
    cream: '#d8ceaa',
  },
  'vanilla-latte': {
    shape: 'ribbed',
    body: '#b49b6b',
    shade: '#927b57',
    liquid: '#a58b60',
    cream: '#d8ceaa',
  },
  cappuccino: {
    shape: 'foam-bowl',
    body: '#cbbd9a',
    shade: '#a99d80',
    liquid: '#927b57',
    cream: '#e0d6b8',
  },
  'cafe-mocha': {
    shape: 'glass-mug',
    body: '#a4ad99',
    shade: '#808e7c',
    liquid: '#65513b',
    cream: '#cbbd9a',
  },
  'caramel-macchiato': {
    shape: 'milk-glass',
    body: '#abb3a0',
    shade: '#8c9a85',
    liquid: '#927b57',
    cream: '#d8ceaa',
  },
  'cold-brew': {
    shape: 'tall-glass',
    body: '#8c9a85',
    shade: '#68786e',
    liquid: '#4f4130',
    cream: '#b6bca7',
  },
  'decaf-americano': {
    shape: 'clay-cup',
    body: '#927b57',
    shade: '#806e50',
    liquid: '#4f4130',
    cream: '#cbbd9a',
  },
  'matcha-latte': {
    shape: 'round-glass',
    body: '#a9b39c',
    shade: '#898d74',
    liquid: '#7d9069',
    cream: '#d8ceaa',
  },
  'hot-chocolate': {
    shape: 'cocoa-mug',
    body: '#a28a71',
    shade: '#806e50',
    liquid: '#65513b',
    cream: '#d8ceaa',
  },
} satisfies Record<DrinkId, DrinkArtwork>
