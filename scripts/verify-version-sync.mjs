import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = resolve(projectRoot, 'package.json');
const androidBuildPath = resolve(projectRoot, 'android', 'app', 'build.gradle');

const fail = (message) => {
  console.error(`Version sync failed: ${message}`);
  process.exit(1);
};

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const androidBuild = readFileSync(androidBuildPath, 'utf8');
const versionNameMatch = androidBuild.match(/^\s*versionName\s+["']([^"']+)["']/m);

if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
  fail('package.json does not contain a valid version string.');
}

if (!versionNameMatch) {
  fail('android/app/build.gradle does not contain versionName.');
}

const androidVersion = versionNameMatch[1];

if (packageJson.version !== androidVersion) {
  fail(`package.json is ${packageJson.version}, Android versionName is ${androidVersion}.`);
}

console.log(`Version sync OK: ${packageJson.version}`);
