import type { EdgeVisual } from "../core/types";
type Point = { x: number; y: number };
export function edgeGeometry(
  source: Point,
  target: Point,
  visual: EdgeVisual,
): { path: string; label: Point; control: Point } {
  const dx = target.x - source.x,
    dy = target.y - source.y,
    length = Math.hypot(dx, dy) || 1;
  const control = {
    x: (source.x + target.x) / 2 - (dy / length) * visual.bend,
    y: (source.y + target.y) / 2 + (dx / length) * visual.bend,
  };
  const points =
    visual.kind === "segments"
      ? visual.points?.length
        ? visual.points
        : [control]
      : [];
  const first = visual.kind === "curve" ? control : (points[0] ?? target);
  const last = visual.kind === "curve" ? control : (points.at(-1) ?? source);
  const clip = (center: Point, toward: Point) => {
    const d = Math.hypot(toward.x - center.x, toward.y - center.y) || 1;
    return {
      x: center.x + ((toward.x - center.x) / d) * 30,
      y: center.y + ((toward.y - center.y) / d) * 30,
    };
  };
  const start = clip(source, first),
    end = clip(target, last);
  let label: Point, path: string;
  if (visual.kind === "curve") {
    path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
    label = {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4,
    };
  } else if (visual.kind === "segments") {
    const route = [start, ...points, end];
    path = route.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    const distances = route
      .slice(1)
      .map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
    let remaining = distances.reduce((a, b) => a + b, 0) / 2;
    label = control;
    for (let i = 0; i < distances.length; i++) {
      if (remaining <= distances[i]) {
        const t = distances[i] ? remaining / distances[i] : 0;
        label = {
          x: route[i].x + (route[i + 1].x - route[i].x) * t,
          y: route[i].y + (route[i + 1].y - route[i].y) * t,
        };
        break;
      }
      remaining -= distances[i];
    }
  } else {
    path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  }
  return {
    path,
    label: { x: label.x + visual.labelX, y: label.y + visual.labelY },
    control,
  };
}
