import { cp, rm } from "node:fs/promises";

const destination = new URL("./public/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await cp(new URL("../toolstack/dist/public/", import.meta.url), destination, {
  recursive: true,
});
