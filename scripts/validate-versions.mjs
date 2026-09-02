import { readFile } from "node:fs/promises";

const manifests = [
  "../package.json",
  "../packages/billing/package.json",
  "../apps/api/package.json",
  "../examples/ai-video/package.json",
];
const versions = await Promise.all(
  manifests.map(async (path) => {
    const manifest = JSON.parse(
      await readFile(new URL(path, import.meta.url), "utf8"),
    );
    return { path, version: manifest.version };
  }),
);
const expected = versions[0].version;

for (const manifest of versions) {
  if (manifest.version !== expected) {
    throw new Error(
      `${manifest.path} has version ${manifest.version}; expected ${expected}`,
    );
  }
}

const openApi = JSON.parse(
  await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
);
if (openApi.info.version !== expected) {
  throw new Error(
    `openapi.json has version ${openApi.info.version}; expected ${expected}`,
  );
}

const expectedImage = `ghcr.io/velobase/velobase:${expected}`;
for (const path of ["../compose.yaml", "../.env.example"]) {
  const contents = await readFile(new URL(path, import.meta.url), "utf8");
  if (!contents.includes(expectedImage)) {
    throw new Error(`${path} does not reference ${expectedImage}`);
  }
}

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag && releaseTag !== `v${expected}`) {
  throw new Error(`release tag ${releaseTag} does not match v${expected}`);
}

console.log(`workspace versions agree on ${expected}`);
