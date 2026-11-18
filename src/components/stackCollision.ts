import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';

// Palette items have no sortable index. Give each seam in the stack its own
// destination so the preview and the eventual insert refer to the same place.
export const stackCollision: CollisionDetection = args => {
  const { active, pointerCoordinates: point, droppableContainers: targets } = args;
  if (point && active.data.current?.from === 'palette') {
    const bounds = targets.find(t => t.id === 'stack-start')?.node.current?.parentElement?.getBoundingClientRect();
    if (!bounds || point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) return [];

    let nearest;
    let shortest = Infinity;
    for (const t of targets) {
      if (!t.data.current?.insertion && !String(t.id).startsWith('slot:')) continue;
      // These bounds move while the gap animates and when the page auto-scrolls.
      const rect = t.node.current?.getBoundingClientRect();
      if (!rect) continue;
      if (t.data.current?.insertion) {
        const distance = Math.max(rect.top - point.y, point.y - rect.bottom, 0);
        if (distance < shortest) { shortest = distance; nearest = t.id; }
      } else if (!['if', 'ifelse', 'ask_ai'].includes(active.data.current.type)
        && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
        return [{ id: t.id }];
      }
    }
    return nearest === undefined ? [] : [{ id: nearest }];
  }

  const hits = pointerWithin(args);
  const slot = hits.find(c => String(c.id).startsWith('slot:'));
  if (slot) return [slot];
  return hits.length ? hits : rectIntersection(args);
};
