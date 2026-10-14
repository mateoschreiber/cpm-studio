import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Read only installed production package metadata and license notices.
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const notices = [
  "CPM Studio — Third-party notices",
  "Generated from installed production dependencies. Keep this file when redistributing dist/.",
];
for (const [directory, entry] of Object.entries(lock.packages)) {
  if (!directory || entry.dev) continue;
  const metadata = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  notices.push(
    `\n${"=".repeat(72)}\n${metadata.name} ${metadata.version}\nLicense: ${metadata.license ?? entry.license ?? "See package license"}\nSource: ${typeof metadata.repository === "string" ? metadata.repository : (metadata.repository?.url ?? metadata.homepage ?? "")}`,
  );
  const names = await readdir(directory);
  for (const name of names.filter((name) =>
    /^(licen[cs]e|notice)(\..*)?$/i.test(name),
  )) {
    try {
      notices.push(
        `\n${name}\n${await readFile(path.join(directory, name), "utf8")}`,
      );
    } catch {
      /* A license directory is not a text file. */
    }
  }
}
await mkdir("public", { recursive: true });
await writeFile("public/THIRD_PARTY_NOTICES.txt", notices.join("\n"), "utf8");
console.log("Production dependency licenses: public/THIRD_PARTY_NOTICES.txt");
