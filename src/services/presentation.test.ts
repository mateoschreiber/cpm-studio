import { describe, expect, it } from "vitest";
import { guideProject } from "../core/fixtures";
import { solveCPM } from "../core/engine";
import { defaultPresentation } from "../core/types";
import { academicSymbols, displayProject } from "./presentation";
import { exportSVG } from "./export";

function resolvedGuide() {
  const project = guideProject();
  project.presentation = { ...defaultPresentation(), activeView: "resolved", resolved: structuredClone(project.visual) };
  return project;
}
const group = (svg: string, activity: string, kind: string) =>
  svg.split(`<g data-activity="${activity}" data-kind="${kind}"`)[1]?.split("</g>")[0] ?? "";

describe("academic presentation and SVG", () => {
  it("exports guide triangles B 6→4 and D 10→11 with event dates 8/10", () => {
    const project = resolvedGuide();
    const svg = exportSVG(project, solveCPM(project));
    expect(group(svg, "B", "ufc")).toContain(">6</text>");
    expect(group(svg, "B", "pff")).toContain(">4</text>");
    expect(group(svg, "D", "ufc")).toContain(">10</text>");
    expect(group(svg, "D", "pff")).toContain(">11</text>");
    const event2 = svg.split('<g data-event="2"')[1].split("</g>")[0];
    expect(event2).toContain(">8</text>");
    expect(event2).toContain(">10</text>");
    expect(event2).toContain('fill="#4f81bd"');
    expect(svg).not.toContain("<circle");
  });
  it("uses independent resolved coordinates and preserves the canonical network", () => {
    const project = resolvedGuide();
    project.presentation!.resolved!.nodes["0"] = { x: 2000, y: 1200 };
    const before = structuredClone(project);
    const result = solveCPM(project);
    const svg = exportSVG(project, result);
    expect(svg).toContain('data-event="0" transform="translate(2036,1230)"');
    project.presentation!.activeView = "network";
    const network = exportSVG(project, result);
    expect(network).toContain('data-event="0" transform="translate(90,220)"');
    expect(network).not.toContain('data-kind="ufc"');
    project.presentation!.activeView = "resolved";
    expect(project).toEqual(before);
  });
  it("clips arrows to large circles rather than the normal radius", () => {
    const project = guideProject();
    project.events = project.events.slice(0, 2);
    project.activities = project.activities.filter(a => a.id === "A");
    project.visual.nodes = { "0": { x: 0, y: 0 }, "1": { x: 200, y: 0 } };
    project.presentation = { ...defaultPresentation(), nodeSize: "large" };
    const svg = exportSVG(project);
    expect(svg).toContain('<circle r="40"');
    expect(svg).toContain('d="M 80 40 L 200 40"');
  });
  it("includes moved academic annotations inside exported bounds", () => {
    const project = resolvedGuide();
    project.presentation!.resolved!.edges.B.startLabel = { x: -2000, y: 1400 };
    const result = solveCPM(project);
    const symbol = academicSymbols(displayProject(project), project.activities.find(a => a.id === "B")!, result)[0];
    const svg = exportSVG(project, result);
    const viewBox = svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
    expect(viewBox[0]).toBeLessThan(symbol.x - 24);
    expect(viewBox[1] + viewBox[3]).toBeGreaterThan(symbol.y + 24);
    expect(group(svg, "B", "ufc")).toContain(`translate(${symbol.x},${symbol.y})`);
  });
  it("respects visibility and escapes labels in the resolved representation", () => {
    const project = resolvedGuide();
    project.events[0].label = '<script>"&';
    const result = solveCPM(project);
    const visible = exportSVG(project, result);
    expect(visible).toContain("&lt;script&gt;&quot;&amp;");
    expect(visible).not.toContain("<script>");
    project.preferences.showLabels = false;
    project.preferences.showDates = false;
    const hidden = exportSVG(project, result);
    expect(hidden).not.toContain("&lt;script&gt;");
    expect(hidden).not.toContain('data-kind="ufc"');
    expect(hidden).not.toContain("MT 0");
  });
});
