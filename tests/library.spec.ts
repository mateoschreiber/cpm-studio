import { expect, test, type Page } from "@playwright/test";
import { guideProject } from "../src/core/fixtures";
import { readSavedProject } from "./helpers";

async function loadGuide(page: Page, name = "Primero") {
  await page.goto("/");
  const project = { ...guideProject(), name };
  await page.getByLabel("Importar proyecto JSON").setInputFiles({
    name: "guia.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  return readSavedProject(page);
}

async function library(page: Page) {
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tus proyectos" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openProject(page: Page, name: string) {
  const dialog = await library(page);
  const row = dialog.locator(".library-project").filter({
    has: page.getByRole("textbox", { name: `Nombre de ${name}`, exact: true }),
  });
  await row.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Nombre del proyecto", { exact: true })).toHaveValue(name);
  return readSavedProject(page);
}

test("la biblioteca crea, duplica, renombra, abre y elimina proyectos independientes", async ({ page }) => {
  const original = await loadGuide(page);
  let dialog = await library(page);
  await dialog.getByRole("button", { name: "Duplicar Primero", exact: true }).click();
  const duplicateName = dialog.getByRole("textbox", { name: "Nombre de Primero (copia)", exact: true });
  await expect(duplicateName).toBeVisible();
  await duplicateName.fill("Segundo");
  await duplicateName.press("Enter");
  await expect(dialog.getByRole("textbox", { name: "Nombre de Segundo", exact: true })).toHaveValue("Segundo");
  await dialog.getByRole("button", { name: "Cerrar biblioteca" }).click();
  const second = await openProject(page, "Segundo");
  expect(second.id).not.toBe(original.id);
  await page.getByLabel("Duración de A", { exact: true }).fill("9");
  await page.getByLabel("Duración de A", { exact: true }).press("Enter");
  await expect(page.getByTestId("project-duration")).toHaveText("16");
  await readSavedProject(page);

  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar actualización", exact: true }).click();
  const name = page.getByLabel("Nombre del proyecto", { exact: true });
  await name.fill("Tercero");
  await name.press("Enter");
  const third = await readSavedProject(page);
  expect(third.activities).toEqual([]);
  expect(third.id).not.toBe(second.id);

  await openProject(page, "Primero");
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await expect(page.getByLabel("Duración de A", { exact: true })).toHaveValue("8");
  await openProject(page, "Segundo");
  dialog = await library(page);
  await dialog.getByRole("button", { name: "Eliminar Segundo", exact: true }).click();
  await dialog.getByRole("button", { name: "Sí, eliminar", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Nombre de Segundo", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cerrar biblioteca" }).click();
  await expect(name).not.toHaveValue("Segundo");
  await openProject(page, "Primero");
  await page.reload();
  await expect(name).toHaveValue("Primero");
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  expect((await readSavedProject(page)).id).toBe(original.id);
});

test("el borrador pendiente sobrevive a recarga y no se mezcla entre proyectos", async ({ page }) => {
  const original = await loadGuide(page, "Con borrador");
  const predecessors = page.getByLabel("Predecesoras de D", { exact: true });
  await predecessors.fill("NO_EXISTE");
  await predecessors.press("Enter");
  await expect(page.getByText("Borrador pendiente.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("project-duration")).toHaveText("15");
  await expect.poll(async () => (await readSavedProject(page)).presentation?.draftRows?.find((row: { id: string }) => row.id === "D")?.predecessors).toEqual(["inexistente:NO_EXISTE"]);
  await page.reload();
  await expect(predecessors).toHaveValue("NO_EXISTE");
  await expect(page.getByText("Borrador pendiente.", { exact: false })).toBeVisible();
  const dialog = await library(page);
  await dialog.getByRole("button", { name: "Duplicar Con borrador", exact: true }).click();
  await expect(dialog.getByLabel("Nombre de Con borrador (copia)", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar biblioteca" }).click();
  const copy = await openProject(page, "Con borrador (copia)");
  expect(copy.id).not.toBe(original.id);
  await expect(predecessors).toHaveValue("NO_EXISTE");
  await page.getByRole("button", { name: "Descartar borrador", exact: true }).click();
  await expect(predecessors).toHaveValue("A, B");
  await expect.poll(async () => (await readSavedProject(page)).presentation?.draftRows).toBeUndefined();
  await openProject(page, "Con borrador");
  await expect(predecessors).toHaveValue("NO_EXISTE");
  await expect(page.getByTestId("project-duration")).toHaveText("15");
});

test("una cuota de escritura agotada informa el error y conserva la edición abierta", async ({ page }) => {
  await loadGuide(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    };
  });
  const duration = page.getByLabel("Duración de A", { exact: true });
  await duration.fill("9");
  await duration.press("Enter");
  await expect(page.getByTestId("project-duration")).toHaveText("16");
  await expect(page.locator(".notice")).toContainText(/quota|guardar|biblioteca/i);
  await expect(duration).toHaveValue("9");
  await expect(page.getByText("Recuperación pendiente", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await expect(duration).toHaveValue("9");
});

test("los puntos de una flecha se insertan, editan por teclado y eliminan con deshacer", async ({ page }) => {
  const original = await loadGuide(page);
  const edge = page.locator('.react-flow__edge[data-id="A"]');
  await edge.locator(".react-flow__edge-interaction").evaluate(element => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() * 0.35);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!);
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: screen.x, clientY: screen.y }));
  });
  await expect(page.getByLabel("Recorrido de flecha", { exact: true })).toHaveValue("segments");
  await expect(page.getByLabel("Punto 1 X", { exact: true })).toBeVisible();
  const x = page.getByLabel("Punto 1 X", { exact: true });
  await x.fill("-20");
  await x.press("Enter");
  await expect.poll(async () => (await readSavedProject(page)).visual.edges.A.points?.[0].x).toBe(-20);
  await page.getByRole("button", { name: "Eliminar punto 1", exact: true }).click();
  await expect(page.getByLabel("Recorrido de flecha", { exact: true })).toHaveValue("straight");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(x).toHaveValue("-20");
  const saved = await readSavedProject(page);
  expect(saved.activities).toEqual(original.activities);
  await expect(page.getByTestId("project-duration")).toHaveText("15");
});
