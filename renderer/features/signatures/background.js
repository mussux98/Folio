// Makes the near-white of an imported picture transparent, so a signature
// photographed or scanned on paper can sit on any page. pixels is RGBA and is
// changed in place. Pure white goes fully clear, dark ink stays solid, and
// the greys in between fade, which keeps soft edges soft.
const CLEAR_ABOVE = 240;
const SOLID_BELOW = 160;

export function whiteToTransparent(pixels) {
  for (let i = 0; i < pixels.length; i += 4) {
    const brightest = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const keep = Math.min(1, Math.max(0, (CLEAR_ABOVE - brightest) / (CLEAR_ABOVE - SOLID_BELOW)));
    pixels[i + 3] = Math.round(pixels[i + 3] * keep);
  }
}
