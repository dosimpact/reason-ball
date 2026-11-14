// Resolve bundled URLs without fetching or decoding audio. Catalog/transport policy lives above shared.
const sources = import.meta.glob<string>('./assets/music/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const getMusicSource = (file: string): string => sources[`./assets/music/${file}`] ?? ''
