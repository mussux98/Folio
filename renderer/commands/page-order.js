// Moving pages: from the pages picked and a gap between pages (counted before
// they are lifted out), the engine's new order and the order that undoes it.
// order[i] is the old position of the page that ends up at i.
export function moveOrder(count, indexes, gap) {
  const picked = [...indexes].sort((a, b) => a - b);
  const rest = Array.from({ length: count }, (_, i) => i).filter((i) => !picked.includes(i));
  const first = rest.filter((i) => i < gap).length;
  const order = [...rest.slice(0, first), ...picked, ...rest.slice(first)];
  const restore = [];
  order.forEach((old, i) => { restore[old] = i; });
  return { order, restore, first, picked, unchanged: order.every((old, i) => old === i) };
}
