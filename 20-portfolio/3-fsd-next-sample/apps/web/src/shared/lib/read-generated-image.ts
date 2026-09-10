/** Browser image decoding is an effect; only commit generated images after it succeeds. */
export async function readGeneratedImage(payload: unknown): Promise<string> {
  const url = payload && typeof payload === 'object' && 'dataUrl' in payload ? payload.dataUrl : undefined;
  // SVG supports the explicit mock image provider. Never accept remote URLs or HTML.
  if (typeof url !== 'string' || !/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) {
    throw new Error('Invalid generated image response');
  }
  const image = new Image();
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty generated image');
  return url;
}
