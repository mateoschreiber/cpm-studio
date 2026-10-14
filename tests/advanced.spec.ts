import { expect, test, type Page } from "@playwright/test";
import { guideProject } from "../src/core/fixtures";
import { generateAOA } from "../src/core/generate";
import type { TableRow } from "../src/core/types";

async function load(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Importar proyecto JSON")
    .setInputFiles({
      name: "guia.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(guideProject())),
    });
  await expect(page.getByTestId("project-duration")).toHaveText("15");
}
async function read(page: Page) {
  await expect(
    page.getByText("Guardado en este navegador", { exact: false }),
  ).toBeVisible();
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("cpm-studio.project.v1")!),
  );
}
async function drag(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  dx: number,
  dy: number,
) {
  const box = (await locator.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    { steps: 12 },
  );
  await page.mouse.up();
}

test("selección múltiple mueve y duplica grupos con una sola operación de deshacer", async ({
  page,
}) => {
  await load(page);
  const first = page.locator('.react-flow__node[data-id="0"]'),
    second = page.locator('.react-flow__node[data-id="1"]');
  await first.click();
  await second.click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  const before = await read(page);
  await drag(page, first, 40, 60);
  const after = await read(page);
  expect(after.visual.nodes["0"].y).not.toBe(before.visual.nodes["0"].y);
  expect(after.visual.nodes["1"].y - before.visual.nodes["1"].y).toBe(
    after.visual.nodes["0"].y - before.visual.nodes["0"].y,
  );
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).visual.nodes)
    .toEqual(before.visual.nodes);
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.getByTestId("project-duration")).toHaveText("15");
});

test("curvatura, segmentos y etiquetas se editan sin cambiar cálculos y se recuperan", async ({
  page,
}) => {
  await load(page);
  const edge = page.locator('.react-flow__edge[data-id="A"]');
  await edge.locator(".react-flow__edge-interaction").click({ force: true });
  await page
    .getByLabel("Recorrido de flecha", { exact: true })
    .selectOption("curve");
  await expect(edge.locator(".react-flow__edge-path")).toHaveAttribute(
    "d",
    / Q /,
  );
  await drag(page, edge.locator(".route-control"), 0, 35);
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  const before = await read(page);
  await drag(page, edge.locator(".edge-label"), 30, -20);
  const moved = await read(page);
  expect(moved.visual.edges.A.labelX).not.toBe(before.visual.edges.A.labelX);
  await page
    .getByLabel("Recorrido de flecha", { exact: true })
    .selectOption("segments");
  await page.getByRole("button", { name: "Segmento", exact: true }).click();
  await expect(edge.locator(".route-control")).toHaveCount(1);
  await drag(page, edge.locator(".route-control"), 20, 20);
  const segmented = await read(page);
  expect(segmented.visual.edges.A.points).toHaveLength(1);
  expect(segmented.activities).toEqual(before.activities);
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await page.reload();
  await expect(edge.locator(".react-flow__edge-path")).toHaveAttribute(
    "d",
    / L .* L /,
  );
  const restored = await read(page);
  expect(restored.visual.edges.A).toEqual(segmented.visual.edges.A);
});

test("reconexión modifica la tabla, una red inválida retira resultados y deshacer la restaura", async ({
  page,
}) => {
  await load(page);
  await page
    .locator('.react-flow__edge[data-id="A"] .react-flow__edge-interaction')
    .click({ force: true });
  await page.getByLabel("Suceso origen", { exact: true }).selectOption("1");
  await expect(page.getByTestId("project-duration")).toHaveText("—");
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Completa una red válida para calcular",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await page.getByLabel("Suceso destino", { exact: true }).selectOption("2");
  await page.getByRole("tab", { name: "Actividades" }).click();
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de C", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de D", exact: true }),
  ).toHaveValue("A, B");
});

test("pagina más de diez rutas críticas sin truncar la enumeración", async ({
  page,
}) => {
  const rows: TableRow[] = [];
  for (let level = 0; level < 4; level++)
    for (const side of ["A", "B"])
      rows.push({
        id: `${side}${level}`,
        name: `${side}${level}`,
        predecessors: level ? [`A${level - 1}`, `B${level - 1}`] : [],
        duration: 1,
        resources: 0,
      });
  const project = generateAOA(rows);
  await page.goto("/");
  await page
    .getByLabel("Importar proyecto JSON")
    .setInputFiles({
      name: "rutas.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(page.getByTestId("project-duration")).toHaveText("4");
  await expect(page.locator(".route")).toHaveCount(10);
  await page.getByLabel("Más rutas críticas", { exact: true }).click();
  await expect(page.locator(".route")).toHaveCount(6);
  await expect(
    page.getByLabel("Más rutas críticas", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Rutas anteriores", { exact: true }).click();
  await expect(page.locator(".route")).toHaveCount(10);
});

test("la recuperación dañada permanece intacta hasta una edición explícita", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("cpm-studio.project.v1", "JSON dañado"),
  );
  await page.goto("/");
  await expect(
    page.getByText("No se pudo recuperar el proyecto guardado.", {
      exact: false,
    }),
  ).toBeVisible();
  // Observe beyond the autosave debounce to detect accidental overwrite of recovery data.
  await page.waitForTimeout(450);
  expect(
    await page.evaluate(() => localStorage.getItem("cpm-studio.project.v1")),
  ).toBe("JSON dañado");
  const title = page.getByLabel("Nombre del proyecto", { exact: true });
  await title.fill("Proyecto recuperado");
  await title.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("cpm-studio.project.v1")!)
            .name;
        } catch {
          return null;
        }
      }),
    )
    .toBe("Proyecto recuperado");
});

test("duración y recursos se actualizan aunque haya precedencias pendientes inválidas", async ({
  page,
}) => {
  await load(page);
  const predecessors = page.getByRole("textbox", {
    name: "Predecesoras de D",
    exact: true,
  });
  await predecessors.fill("NoExiste");
  await predecessors.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  const duration = page.getByRole("textbox", {
    name: "Duración de A",
    exact: true,
  });
  await duration.fill("9");
  await duration.press("Enter");
  await expect(page.getByTestId("project-duration")).toHaveText("16");
  const resources = page.getByRole("textbox", {
    name: "Recursos de A",
    exact: true,
  });
  await resources.fill("12");
  await resources.press("Enter");
  await expect
    .poll(
      async () =>
        (await read(page)).activities.find((a: { id: string }) => a.id === "A")
          .resources,
    )
    .toBe(12);
  await expect(predecessors).toHaveValue("NoExiste");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Descartar borrador", exact: true })
    .click();
  await expect(predecessors).toHaveValue("A, B");
  await expect(duration).toHaveValue("9");
});
