import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "./store";
import { emptyProject } from "./core/types";

describe("historial de proyecto", () => {
  beforeEach(() =>
    useProjectStore.setState({
      project: emptyProject(),
      past: [],
      future: [],
      gesture: null,
    }),
  );
  it("agrupa un arrastre completo en una sola operación reversible", () => {
    const s = useProjectStore.getState();
    s.beginGesture();
    s.edit((p) => {
      p.name = "paso 1";
    });
    s.edit((p) => {
      p.name = "paso 2";
    });
    s.endGesture();
    expect(useProjectStore.getState().past).toHaveLength(1);
    s.undo();
    expect(useProjectStore.getState().project.name).toBe(emptyProject().name);
    s.redo();
    expect(useProjectStore.getState().project.name).toBe("paso 2");
  });
  it("una edición nueva invalida rehacer sin mutar estados previos", () => {
    const s = useProjectStore.getState();
    const original = s.project;
    s.edit((p) => {
      p.name = "uno";
    });
    s.undo();
    s.edit((p) => {
      p.name = "dos";
    });
    expect(original.name).toBe(emptyProject().name);
    expect(useProjectStore.getState().future).toHaveLength(0);
  });
});
