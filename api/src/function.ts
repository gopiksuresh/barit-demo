import { onRequest } from 'firebase-functions/v2/https';
import type { Express } from 'express';

// Cloud Functions entry. Firebase Hosting rewrites /api/** here (see firebase.json).
//
// The Nest app (and Prisma, firebase-admin, Express…) is loaded lazily on the first
// request, not at module load. The Firebase CLI loads this module to discover
// functions with a 10s timeout — during `firebase deploy` and in the emulator — and
// loading the whole app eagerly can exceed that on slow disks.
let server: Promise<Express> | undefined;

async function getServer(): Promise<Express> {
  await import('reflect-metadata');
  const { createApp } = await import('./app.factory');
  return (await createApp()).server;
}

export const api = onRequest(
  { region: 'asia-south1', memory: '512MiB', timeoutSeconds: 60, concurrency: 40 },
  async (req, res) => {
    server ??= getServer().catch((e) => {
      server = undefined; // allow a retry on the next request
      throw e;
    });
    // Cloud Functions has already consumed the request stream into req.rawBody, so
    // multer (dish-photo uploads) would see an empty body. Replay it for multipart.
    if (req.rawBody && String(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
      const raw = req.rawBody;
      (req as unknown as { pipe: (dest: NodeJS.WritableStream) => NodeJS.WritableStream }).pipe = (dest) => {
        dest.end(raw);
        return dest;
      };
    }
    (await server)(req, res);
  },
);
