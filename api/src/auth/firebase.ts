import { App, getApps, initializeApp } from 'firebase-admin/app';

/**
 * Lazily initialises firebase-admin. With FIREBASE_AUTH_EMULATOR_HOST set (dev),
 * token verification goes to the Auth emulator and no credentials are needed.
 * In Cloud Functions, default service-account credentials are picked up automatically.
 */
export function firebaseApp(): App {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || undefined,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    })
  );
}

export interface VerifiedUser {
  uid: string;
  phone: string | null;
}

/** Injection token so tests can swap in a fake verifier. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedUser>;
}

export class FirebaseTokenVerifier implements TokenVerifier {
  async verify(idToken: string): Promise<VerifiedUser> {
    // Loaded lazily: firebase-admin/auth pulls in ESM-only deps (jose) that Jest can't
    // require, and the e2e tests swap this verifier out anyway.
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth(firebaseApp()).verifyIdToken(idToken);
    return { uid: decoded.uid, phone: decoded.phone_number ?? null };
  }
}
