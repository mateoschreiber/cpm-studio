import { EPSILON, nodeRadius, type CPMResult, type Project } from "../core/types";
import { edgeGeometry } from "./geometry";
import { downloadFile } from "./persistence";
import { academicSymbols, displayProject, eventCenter, isResolved } from "./presentation";
const xml = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const number = (v: number) =>
  Number(v.toFixed(6)).toLocaleString("es-PY", { maximumFractionDigits: 6 });
export function exportSVG(project: Project, result?: CPMResult): string {
  project = displayProject(project);
  const radius = nodeRadius(project), resolved = isResolved(project);
  const bounds: { x: number; y: number }[] = [];
  const shapes: string[] = [];
  for (const a of project.activities) {
    const s = project.visual.nodes[a.source],
      t = project.visual.nodes[a.target],
      v = project.visual.edges[a.id];
    if (!s || !t || !v) continue;
    const g = edgeGeometry(
      eventCenter(project, a.source),
      eventCenter(project, a.target),
      v,
      { radius, shape: resolved ? "diamond" : "circle" },
    );
    const critical =
      project.preferences.highlight && result?.activities[a.id]?.critical;
    const color = critical ? project.preferences.criticalColor : v.color;
    const marker = `arrow${shapes.length}`;
    const text = a.dummy ? "f · 0" : `${a.name} · ${number(a.duration)}`;
    const showMargin = !!result && project.preferences.showDates;
    const labelWidth = Math.max(50, text.length * 7 + 16);
    bounds.push(
      g.control,
      ...(v.points ?? []),
      { x: g.label.x - labelWidth / 2, y: g.label.y - 24 },
      { x: g.label.x + labelWidth / 2, y: g.label.y + (showMargin ? 30 : 18) },
    );
    shapes.push(
      `<defs><marker id="${marker}" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${xml(color)}"/></marker></defs><path d="${g.path}" fill="none" stroke="${xml(color)}" stroke-width="${v.width}"${a.dummy ? ' stroke-dasharray="7 5"' : ""} marker-end="url(#${marker})"/>`,
    );
    if (resolved && result?.activities[a.id] && project.preferences.showDates) {
      for (const symbol of academicSymbols(project, a, result)) {
        const half = Math.max(24, number(symbol.value).length * 4 + 4);
        bounds.push({ x: symbol.x - half, y: symbol.y - 24 }, { x: symbol.x + half, y: symbol.y + 24 });
        shapes.push(`<g data-activity="${xml(a.id)}" data-kind="${symbol.kind}" transform="translate(${symbol.x},${symbol.y})"><title>${symbol.kind === "ufc" ? "Última fecha de comienzo" : "Primera fecha de finalización"}: ${number(symbol.value)}</title><polygon points="-16,-16 19,0 -16,16" transform="rotate(${symbol.angle})" fill="white" stroke="#16334a" stroke-width="1.5"/><text text-anchor="middle" dominant-baseline="central" fill="#16334a" font-size="12" font-weight="650">${number(symbol.value)}</text></g>`);
      }
    }
    shapes.push(
      `<g transform="translate(${g.label.x},${g.label.y})"><rect x="${-labelWidth / 2}" y="-13" width="${labelWidth}" height="${showMargin ? 39 : 26}" rx="5" fill="white"/><text text-anchor="middle" dominant-baseline="central" fill="${xml(color)}">${xml(text)}</text>${showMargin ? `<text y="19" text-anchor="middle" font-size="11" fill="#64748b">MT ${number(result?.activities[a.id]?.mt ?? 0)}</text>` : ""}</g>`,
    );
  }
  for (const e of project.events) {
    const p = project.visual.nodes[e.id];
    if (!p) continue;
    const label = project.preferences.showLabels ? e.label : "•";
    const center = eventCenter(project, e.id), halfWidth = radius * (resolved ? 1.2 : 1);
    bounds.push(
      { x: center.x - Math.max(halfWidth, label.length * 4), y: p.y - (resolved && project.preferences.showLabels ? 26 : 2) },
      { x: center.x + Math.max(halfWidth, label.length * 4), y: p.y + radius * 2 + 2 },
    );
    const dates = result?.events[e.id];
    const critical =
      project.preferences.highlight &&
      dates &&
      Math.abs(dates.early - dates.late) < EPSILON;
    const border = critical ? project.preferences.criticalColor : "#284b63";
    if (resolved) {
      shapes.push(`<g data-event="${xml(e.id)}" transform="translate(${center.x},${center.y})"><polygon points="${-halfWidth},0 0,${-radius} ${halfWidth},0 0,${radius}" fill="#4f81bd" stroke="${xml(border)}" stroke-width="2"/><path d="M 0 ${-radius} V ${radius}" stroke="#284b63" stroke-width="2"/>${project.preferences.showLabels ? `<text text-anchor="middle" y="${-radius - 10}" fill="#16334a" font-weight="700">${xml(label)}</text>` : ""}${project.preferences.showDates ? `<text x="${-radius * .54}" y="5" text-anchor="middle" fill="white">${dates ? number(dates.early) : "—"}</text><text x="${radius * .54}" y="5" text-anchor="middle" fill="white">${dates ? number(dates.late) : "—"}</text>` : ""}</g>`);
    } else {
      shapes.push(`<g data-event="${xml(e.id)}" transform="translate(${center.x},${center.y})"><circle r="${radius}" fill="white" stroke="${xml(border)}" stroke-width="2"/><text text-anchor="middle" y="${project.preferences.showDates ? -8 : 5}" fill="#16334a">${xml(label)}</text>${project.preferences.showDates ? `<path d="M ${-radius + 2} 0 H ${radius - 2} M 0 0 V ${radius - 2}" stroke="#cbd5e1"/><text x="${-radius / 2 + 1}" y="${radius * .6}" font-size="11" text-anchor="middle" fill="#16334a">${dates ? number(dates.early) : "—"}</text><text x="${radius / 2 - 1}" y="${radius * .6}" font-size="11" text-anchor="middle" fill="#16334a">${dates ? number(dates.late) : "—"}</text>` : ""}</g>`);
    }
  }
  const minX = Math.min(0, ...bounds.map((p) => p.x)) - 35,
    minY = Math.min(0, ...bounds.map((p) => p.y)) - 35,
    maxX = Math.max(100, ...bounds.map((p) => p.x)) + 35,
    maxY = Math.max(100, ...bounds.map((p) => p.y)) + 35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX - minX}" height="${maxY - minY}" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" font-family="Arial, sans-serif" font-size="13"><title>${xml(project.name)}</title><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="white"/>${shapes.join("")}</svg>`;
}
export async function exportPNG(
  project: Project,
  result?: CPMResult,
): Promise<void> {
  const svg = exportSVG(project, result);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
      image.src = url;
    });
    const scale = Math.min(2, 8192 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(image.width * scale);
    canvas.height = Math.ceil(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite exportar PNG.");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("No se pudo exportar PNG.")),
        "image/png",
      ),
    );
    downloadFile(`${project.name || "CPM Studio"}.png`, png, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
