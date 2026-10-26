import { mkdir, copyFile } from "node:fs/promises";
await mkdir(new URL("../vendor/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../node_modules/elkjs/lib/elk.bundled.js", import.meta.url),
  new URL("../vendor/elk.bundled.js", import.meta.url),
);
await copyFile(
  new URL("../node_modules/elkjs/LICENSE.md", import.meta.url),
  new URL("../vendor/ELK-LICENSE.md", import.meta.url),
);
console.log("Local ELK layout engine and license copied to vendor/.");
