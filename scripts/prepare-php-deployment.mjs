import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');
const outputRoot = path.join(projectRoot, 'php-package');
const phpSource = path.join(projectRoot, 'php');

await cp(path.join(phpSource, 'api.php'), path.join(outputRoot, 'api.php'));
await cp(path.join(phpSource, '.htaccess'), path.join(outputRoot, '.htaccess'));
await cp(path.join(phpSource, '.user.ini'), path.join(outputRoot, '.user.ini'));
await cp(path.join(projectRoot, '.env.example'), path.join(outputRoot, '.env.example'));
await cp(path.join(projectRoot, 'DEPLOY_PHP.md'), path.join(outputRoot, 'README.txt'));
await mkdir(path.join(outputRoot, 'private-storage', 'uploads'), { recursive: true });
await cp(path.join(phpSource, 'storage.htaccess'), path.join(outputRoot, 'private-storage', '.htaccess'));

console.log(`Upload-only PHP package prepared at ${outputRoot}`);
