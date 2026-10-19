import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

function storageRoot() {
  const configuredRoot = process.env.UPLOAD_DIR?.trim();
  return configuredRoot
    ? path.resolve(/* turbopackIgnore: true */ configuredRoot)
    : path.join(process.cwd(), 'storage', 'uploads');
}

function storagePath(fileKey: string) {
  const root = storageRoot();
  const normalizedKey = fileKey.replaceAll('\\', '/');
  const target = path.resolve(root, ...normalizedKey.split('/'));
  if (!normalizedKey || normalizedKey.startsWith('/') || target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid private file path.');
  }
  return target;
}

export async function savePrivateFile(fileKey: string, file: File) {
  const target = storagePath(fileKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await file.arrayBuffer()), { flag: 'wx' });
}

export async function readPrivateFile(fileKey: string) {
  try {
    return await readFile(storagePath(fileKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deletePrivateFile(fileKey: string) {
  try {
    await unlink(storagePath(fileKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
