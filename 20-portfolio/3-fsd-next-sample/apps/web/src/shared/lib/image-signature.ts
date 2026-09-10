/** Checks file signatures, not full image decoding or malware safety. */
export function hasRasterImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  const matches = (offset: number, values: readonly number[]) => values.every((value, index) => bytes[offset + index] === value);
  if (mimeType === "image/png") return matches(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  if (mimeType === "image/jpeg") return matches(0, [255, 216, 255]);
  if (mimeType === "image/webp") return matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]);
  if (mimeType === "image/avif") return matches(4, [102, 116, 121, 112]) && (matches(8, [97, 118, 105, 102]) || matches(8, [97, 118, 105, 115]));
  return false;
}
