// A picture turned by quarter turns (1 is clockwise, -1 anticlockwise), as PNG bytes.
export async function turnPicture(png, quarterTurns) {
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(bitmap.height, bitmap.width);
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}
