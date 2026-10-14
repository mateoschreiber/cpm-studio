import { expect, test, type Page } from "@playwright/test";
import { guideProject } from "../src/core/fixtures";

async function guide(page: Page) {
  await page.goto("/");
  await page.getByText("Ejercicios de referencia", { exact: true }).click();
  await page
    .getByRole("button", { name: "Guía · 5 actividades", exact: true })
    .click();
  await expect(page.getByTestId("project-duration")).toHaveText("15");
}
async function saved(page: Page) {
  await expect(
    page.getByText("Guardado en este navegador", { exact: false }),
  ).toBeVisible();
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("cpm-studio.project.v1")!),
  );
}
async function commit(page: Page, label: string, value: string) {
  const input = page.getByRole("textbox", { name: label, exact: true });
  await input.fill(value);
  await input.press("Enter");
}
test("resuelve ambos ejercicios y conserva los resultados al cambiar de panel", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await guide(page);
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(page.locator(".route")).toHaveText(/A.*C.*E/);
  const b = page
    .locator(".results-table tbody tr")
    .filter({ has: page.locator("td strong", { hasText: /^B$/ }) });
  await expect(b.locator("td").nth(7)).toHaveText("6");
  await expect(b.locator("td").nth(8)).toHaveText("4");
  await expect(b.locator("td").nth(9)).toHaveText("4");
  await page.getByRole("tab", { name: "Actividades" }).click();
  await page.getByText("Ejercicios de referencia", { exact: true }).click();
  await page
    .getByRole("button", { name: "Ejercicio · 14 actividades", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar actualización" }).click();
  await expect(page.getByTestId("project-duration")).toHaveText("21");
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(page.locator(".route")).toHaveText(/A.*G.*D.*E.*L/);
  expect(errors).toEqual([]);
});

test("construye con mouse, mueve sucesos, deshace y admite ficticias", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.getByTestId("network-canvas");
  await page.getByRole("button", { name: "Suceso", exact: true }).click();
  await canvas.click({ position: { x: 140, y: 125 } });
  await canvas.click({ position: { x: 360, y: 125 } });
  await canvas.click({ position: { x: 580, y: 125 } });
  const node = (id: string) =>
    page.locator(`.react-flow__node[data-id="${id}"]`);
  const nodes = page.locator(".react-flow__node");
  const ids = await nodes.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-id")!),
  );
  expect(ids).toHaveLength(3);
  await page.getByRole("button", { name: "Actividad", exact: true }).click();
  await node(ids[0]).click();
  await node(ids[1]).click();
  await commit(page, "Duración de actividad", "3");
  await node(ids[1]).click();
  await node(ids[2]).click();
  await commit(page, "Duración de actividad", "2");
  await expect(page.getByTestId("project-duration")).toHaveText("5");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  const before = await saved(page);
  const box = (await node(ids[0]).boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 22);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 72, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).visual.nodes[ids[0]].y)
    .not.toBe(before.visual.nodes[ids[0]].y);
  await expect(page.getByTestId("project-duration")).toHaveText("5");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).visual.nodes[ids[0]])
    .toEqual(before.visual.nodes[ids[0]]);
  await page.getByRole("button", { name: "Suceso", exact: true }).click();
  await canvas.click({ position: { x: 740, y: 240 } });
  const lastId = await nodes.last().getAttribute("data-id");
  await page.getByRole("button", { name: "Ficticia", exact: true }).click();
  await node(ids[2]).click();
  await node(lastId!).click();
  await expect(page.getByTestId("project-duration")).toHaveText("5");
  expect(
    (await saved(page)).activities.filter((a: { dummy: boolean }) => a.dummy),
  ).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.getByTestId("project-duration")).toHaveText("5");
});

test("la tabla genera, sincroniza y conserva precedencias canceladas entre vistas", async ({
  page,
}) => {
  await guide(page);
  await commit(page, "Duración de A", "9");
  await expect(page.getByTestId("project-duration")).toHaveText("16");
  await commit(page, "Predecesoras de D", "B");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de D", exact: true }),
  ).toHaveValue("B");
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(
    page.getByText("Resultados de la red vigente.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Actividades" }).click();
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de D", exact: true }),
  ).toHaveValue("B");
  // A canonical edit through the inspector must not discard the pending structural field.
  await page
    .locator(".react-flow__edge-interaction")
    .first()
    .click({ force: true });
  await commit(page, "Recursos de actividad", "7");
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de D", exact: true }),
  ).toHaveValue("B");
  await page
    .getByRole("button", { name: "Aplicar cambios", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar actualización" }).click();
  await expect(
    page.getByRole("textbox", { name: "Predecesoras de D", exact: true }),
  ).toHaveValue("B");
  await expect(page.locator(".draft-banner:visible")).toHaveCount(0);
});

test("genera desde cero y permite eliminar la última fila", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Agregar actividad", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await commit(page, "Duración de A1", "2.5");
  await expect(page.getByTestId("project-duration")).toHaveText("2,5");
  await page.getByRole("button", { name: "Eliminar A1", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar actualización" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByTestId("project-duration")).toHaveText("—");
});

test("Escape cancela, entradas inválidas no cambian el proyecto y la selección cambia de tipo", async ({
  page,
}) => {
  await guide(page);
  const duration = page.getByRole("textbox", {
    name: "Duración de A",
    exact: true,
  });
  await duration.fill("99");
  await duration.press("Escape");
  await expect(duration).toHaveValue("8");
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await duration.fill("-2");
  await duration.press("Enter");
  await expect(duration).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await page.locator('.react-flow__node[data-id="0"]').click();
  await expect(
    page.getByRole("textbox", { name: "Identificador del suceso" }),
  ).toBeVisible();
  await page
    .locator(".react-flow__edge-interaction")
    .first()
    .click({ force: true });
  await expect(
    page.getByRole("textbox", { name: "Nombre de actividad", exact: true }),
  ).toBeVisible();
  await page.locator('.react-flow__node[data-id="1"]').click();
  await expect(
    page.getByRole("textbox", { name: "Identificador del suceso" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre de actividad", exact: true }),
  ).toHaveCount(0);
});

test("importa JSON, exporta SVG y PNG y rechaza un archivo dañado", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Importar proyecto JSON").setInputFiles({
    name: "guia.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(guideProject())),
  });
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await page.getByLabel("Exportar diagrama", { exact: true }).click();
  const svgWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Diagrama SVG" }).click();
  const svg = await svgWait;
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  expect(await svg.failure()).toBeNull();
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Diagrama PNG" }).click();
  const png = await pngWait;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(await png.failure()).toBeNull();
  await page.getByLabel("Importar proyecto JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(
    page.getByText("No se abrió el proyecto.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("project-duration")).toHaveText("15");
});

test("funciona sin recursos externos y se adapta a una pantalla pequeña", async ({
  page,
}) => {
  const external: string[] = [];
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith("http://127.0.0.1:4173/")) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await guide(page);
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(page.locator(".route")).toHaveText(/A.*C.*E/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(external).toEqual([]);
});

test("ingresa el ejercicio completo desde la tabla y obtiene una red editable equivalente", async ({
  page,
}) => {
  await page.goto("/");
  const data = [
    ["A", "", "8", "5"],
    ["B", "", "4", "4"],
    ["C", "A", "5", "3"],
    ["D", "A, B", "3", "2"],
    ["E", "C, D", "2", "6"],
  ];
  for (const [name, predecessors, duration, resources] of data) {
    await page
      .getByRole("button", { name: "Agregar actividad", exact: true })
      .click();
    const confirm = page.getByRole("button", {
      name: "Confirmar actualización",
    });
    if (await confirm.isVisible()) await confirm.click();
    await expect(
      page.getByRole("textbox", { name: "Actividad A1", exact: true }),
    ).toBeVisible();
    await commit(page, "Actividad A1", name);
    await commit(page, `Duración de ${name}`, duration);
    await commit(page, `Recursos de ${name}`, resources);
    if (predecessors) {
      await commit(page, `Predecesoras de ${name}`, predecessors);
      if (await confirm.isVisible()) await confirm.click();
    }
  }
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await page.getByRole("tab", { name: "Resultados CPM" }).click();
  await expect(page.locator(".route")).toHaveText(/A.*C.*E/);
  const project = await saved(page);
  expect(
    project.activities.filter((a: { dummy: boolean }) => !a.dummy),
  ).toHaveLength(5);
  await expect(page.locator(".react-flow__node")).toHaveCount(
    project.events.length,
  );
  await page
    .getByRole("button", { name: "Ajustar a pantalla", exact: true })
    .click();
  await page.locator(".react-flow__edge .edge-label").first().click();
  await expect(
    page.getByRole("textbox", { name: "Nombre de actividad", exact: true }),
  ).toBeVisible();
});
