import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, relative, extname } from "node:path";
const root = resolve("src");
const layers = ["shared", "entities", "features", "widgets", "app"];
const violations = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const file = resolve(directory, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (/\.[tj]sx?$/.test(file)) check(file);
  }
}
function check(file) {
  const owner = relative(root, file).split("/");
  for (const match of readFileSync(file, "utf8").matchAll(
    /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g,
  )) {
    const target = relative(root, resolve(dirname(file), match[1])).split("/");
    const sourceLayer = layers.indexOf(owner[0]);
    const targetLayer = layers.indexOf(target[0]);
    if (targetLayer > sourceLayer)
      violations.push(`${relative(root, file)} imports upward: ${match[1]}`);
    if (
      sourceLayer === targetLayer &&
      owner[1] !== target[1] &&
      !["app", "shared"].includes(owner[0])
    )
      violations.push(
        `${relative(root, file)} imports another same-layer slice: ${match[1]}`,
      );
    if (
      targetLayer >= 0 &&
      sourceLayer !== targetLayer &&
      target.length > 2 &&
      !extname(target.at(-1))
    )
      violations.push(
        `${relative(root, file)} bypasses public slice index: ${match[1]}`,
      );
  }
}
walk(root);
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else console.log("FSD dependency direction and public imports: PASS");
