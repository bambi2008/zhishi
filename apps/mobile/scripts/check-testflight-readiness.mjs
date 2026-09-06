import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';


const projectRoot = resolve(import.meta.dirname, '..');
const appConfig = JSON.parse(readFileSync(resolve(projectRoot, 'app.json'), 'utf8')).expo;
const failures = [];
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const splashPlugin = appConfig.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);
const splashImage = splashPlugin?.[1]?.image;

if (!apiBaseUrl) {
  failures.push('EXPO_PUBLIC_API_BASE_URL is required for an installable build.');
} else {
  let parsedUrl;
  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    failures.push('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
  }
  if (parsedUrl && parsedUrl.protocol !== 'https:') {
    failures.push('EXPO_PUBLIC_API_BASE_URL must use HTTPS for TestFlight.');
  }
}

for (const relativePath of [
  appConfig.icon,
  splashImage,
  appConfig.android?.adaptiveIcon?.foregroundImage,
]) {
  if (!relativePath || !existsSync(resolve(projectRoot, relativePath))) {
    failures.push(`Missing configured app asset: ${relativePath ?? '(not configured)'}`);
  }
}

if (!appConfig.ios?.bundleIdentifier) failures.push('Missing ios.bundleIdentifier.');
if (!appConfig.ios?.buildNumber) failures.push('Missing ios.buildNumber.');
if (!existsSync(resolve(projectRoot, 'eas.json'))) failures.push('Missing eas.json.');

if (failures.length) {
  console.error('TestFlight readiness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`TestFlight readiness check passed for ${appConfig.ios.bundleIdentifier}.`);
console.log(`Production API: ${apiBaseUrl}`);
