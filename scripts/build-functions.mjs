// Builds the deployable Cloud Functions package in .deploy/functions:
//   - compiles the API with tsc (nest build), then bundles api/dist/function.js with esbuild
//     (inlines @barit/shared + the generated Prisma client; every other npm package stays
//     external and is installed normally)
//   - writes a trimmed package.json (no workspace deps) so Cloud Build can `npm install` it
//   - copies api/.env -> .env.local for the Functions emulator (skipping keys Firebase reserves)
// Usage: node scripts/build-functions.mjs [--install]
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = join(root, 'api');
const out = join(root, '.deploy', 'functions');
const install = process.argv.includes('--install');

const apiPkg = JSON.parse(readFileSync(join(api, 'package.json'), 'utf8'));
const runtimeDeps = Object.fromEntries(
  Object.entries(apiPkg.dependencies).filter(([name]) => name !== '@barit/shared'),
);

// Compile with tsc first (nest build; prebuild runs `prisma generate`). esbuild alone can't
// be used on the .ts sources: it doesn't emit decorator metadata, which Nest's DI needs.
execSync('npm run build', { cwd: api, stdio: 'inherit' });

// Only the files below are (re)written; anything else in the folder — node_modules,
// a hand-written .env.<projectId> for deploy — is left alone.
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(api, 'dist', 'function.js')],
  outfile: join(out, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  // Everything from npm is installed in the deploy dir, except our workspace package.
  external: Object.keys(runtimeDeps).flatMap((d) => [d, `${d}/*`]),
  alias: { '@barit/shared': join(root, 'packages', 'shared', 'src', 'index.ts') },
  // Nest's optional peer integrations are require()d lazily; they're not installed.
  plugins: [
    {
      name: 'nest-optional',
      setup(b) {
        const optional = /^(@nestjs\/(microservices|websockets|platform-socket\.io)|class-transformer\/storage|@fastify\/static|@grpc\/.*)(\/.*)?$/;
        b.onResolve({ filter: optional }, (args) => ({ path: args.path, external: true }));
      },
    },
  ],
  logLevel: 'info',
});

writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    { name: 'barit-functions', private: true, main: 'index.js', engines: { node: '22' }, dependencies: runtimeDeps },
    null,
    2,
  ) + '\n',
);

// Emulator-only env (.env.local is never deployed). Firebase reserves FIREBASE_* / X_GOOGLE_* / EXT_* and PORT.
const envFile = join(api, '.env');
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .filter((l) => !/^(FIREBASE_|X_GOOGLE_|EXT_|PORT=|GCLOUD_|K_)/.test(l.trim()));
  // Local-disk uploads from the emulated function go to the same folder the dev server uses.
  lines.push(`UPLOAD_DIR=${join(api, 'uploads')}`);
  writeFileSync(join(out, '.env.local'), lines.join('\n') + '\n');
}

if (install) {
  console.log('Installing runtime dependencies in .deploy/functions …');
  execSync('npm install --omit=dev --no-audit --no-fund --no-package-lock', { cwd: out, stdio: 'inherit' });
}
console.log(`✓ Functions package ready at ${out}`);
