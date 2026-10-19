import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');
const outputRoot = path.join(projectRoot, 'deployment-package');

if (!outputRoot.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error('Refusing to prepare a deployment package outside the project directory.');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(standaloneRoot, outputRoot, { recursive: true });
await mkdir(path.join(outputRoot, '.next'), { recursive: true });
await cp(path.join(projectRoot, '.next', 'static'), path.join(outputRoot, '.next', 'static'), { recursive: true });
await cp(path.join(projectRoot, 'public'), path.join(outputRoot, 'public'), { recursive: true });
await cp(path.join(projectRoot, '.env.example'), path.join(outputRoot, '.env.example'));
await cp(path.join(projectRoot, 'DEPLOY_CYBERPANEL.md'), path.join(outputRoot, 'DEPLOY_CYBERPANEL.md'));
await mkdir(path.join(outputRoot, 'storage', 'uploads'), { recursive: true });

// Images are configured as unoptimized static files, so platform-specific Sharp
// binaries from the Windows build are neither needed nor safe to ship to Linux.
for (const relativePath of [
  ['node_modules', 'sharp'],
  ['node_modules', '@img'],
  ['node_modules', 'next', 'node_modules', 'sharp'],
  ['node_modules', 'next', 'node_modules', '@img'],
]) {
  await rm(path.join(outputRoot, ...relativePath), { recursive: true, force: true });
}

const topLevelEntries = await readdir(outputRoot);
if (!topLevelEntries.includes('server.js')) throw new Error('The standalone server was not copied.');
if (!topLevelEntries.includes('.next')) throw new Error('The Next.js static files were not copied.');

console.log(`Hosting package prepared at ${outputRoot}`);
