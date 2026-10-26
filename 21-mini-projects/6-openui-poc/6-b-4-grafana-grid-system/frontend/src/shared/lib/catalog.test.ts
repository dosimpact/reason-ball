// Regression contract: every original 6-2 signature remains, except additive Card children.
import { describe, expect, it } from 'vitest';
import { createParser } from '@openuidev/lang-core';
import baseline from '../../../tests/fixtures/document-catalog.json';
import spec from '../ui/openui/generated/spec.json';
const components: Record<string, { signature: string }> = spec.components;
describe('6-2 contracts and integration policy', () => {
  for (const [name, original] of Object.entries(baseline.components)) {
    it(`preserves ${name}`, () => {
      if (name !== 'Card') expect(components[name]).toEqual(original);
      else {
        expect(components.Card.signature).toContain('sources?:');
        const oldChildren = original.signature.split('children: (')[1].split(')[]')[0].split(' | ');
        for (const child of oldChildren) expect(components.Card.signature).toContain(child);
      }
    });
  }
  it('keeps base root and resolves component/function collisions', () => {
    expect(spec.root).toBe('Card');
    expect(Object.keys(components)).toHaveLength(138);
    expect(components.Col.signature).toContain('label: string');
    expect(components.VStack.signature).toContain('children: Node[]');
    expect(components).not.toHaveProperty('IuiLabel');
    expect(components).not.toHaveProperty('Divider');
    expect(spec.functions).toHaveProperty('IuiSlice');
    expect(spec.functions).not.toHaveProperty('Slice');
    expect(components).toHaveProperty('Slice');
  });
  it('parses original comparison with integrated reactive widgets', () => {
    const program = `root = Card([CardHeader("Integrated regression"), Table([Col("Company", ["Demo"])]), body], [{title:"Demo source", sourceName:"Fixture", url:"https://example.com"}])
$count = 0
body = VStack([IuiText("Count: " + $count), IuiButton("Increment", @Set($count, $count + 1)), IuiText(@Join(@IuiSlice(["a", "b", "c"], 0, 2), ", "))])`;
    const result = createParser(spec.schema, spec.root).parse(program);
    expect(result.root).not.toBeNull();
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
  });
});
