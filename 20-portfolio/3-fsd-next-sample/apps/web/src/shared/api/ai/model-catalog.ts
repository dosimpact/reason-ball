import { z } from 'zod';

export const modelCapabilitiesSchema = z.object({
  vision: z.boolean().nullable(),
  documents: z.boolean().nullable(),
  tools: z.boolean().nullable(),
  reasoning: z.boolean().nullable(),
}).strict();

export type ModelCapabilities = z.infer<typeof modelCapabilitiesSchema>;
export type ChatModelEntry = {
  id: string;
  capabilities: ModelCapabilities;
  capabilitySource: 'configured' | 'mock' | 'unverified';
};

export const unknownModelCapabilities: Readonly<ModelCapabilities> = Object.freeze({
  vision: null, documents: null, tools: null, reasoning: null,
});

const configuredCapabilitiesSchema = z.record(z.string().min(1), modelCapabilitiesSchema.partial());
const modelEntrySchema = z.object({
  id: z.string().trim().min(1),
  capabilities: modelCapabilitiesSchema,
  capabilitySource: z.enum(['configured', 'mock', 'unverified']),
}).strict();

// Environment access belongs to config.ts. Model names never imply capabilities.
export function buildChatModelEntries(ids: readonly string[], configured: string | undefined, mock: boolean): ChatModelEntry[] {
  const overrides = configuredCapabilitiesSchema.parse(JSON.parse(configured ?? '{}'));
  return [...new Set(ids)].map((id) => {
    const explicit = Object.hasOwn(overrides, id) ? overrides[id] : undefined;
    return {
      id,
      capabilities: explicit
        ? { ...unknownModelCapabilities, ...explicit }
        : mock ? { vision: true, documents: true, tools: true, reasoning: false } : { ...unknownModelCapabilities },
      capabilitySource: explicit ? 'configured' : mock ? 'mock' : 'unverified',
    };
  });
}

export function parseChatModelEntries(input: unknown): ChatModelEntry[] {
  const entries = z.array(modelEntrySchema).parse(input);
  const byId = new Map<string, ChatModelEntry>();
  for (const entry of entries) {
    const previous = byId.get(entry.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error('Conflicting model capabilities');
    byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

type InputMessage = { parts: readonly { type: string; mediaType?: string }[] };

export function unsupportedChatInput(capabilities: Readonly<ModelCapabilities>, messages: readonly InputMessage[]): 'vision' | 'documents' | 'tools' | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'file') {
        const required = typeof part.mediaType === 'string' && part.mediaType.startsWith('image/') ? 'vision' : 'documents';
        if (capabilities[required] !== true) return required;
      }
      if ((part.type.startsWith('tool-') || part.type === 'dynamic-tool') && capabilities.tools !== true) return 'tools';
    }
  }
}
