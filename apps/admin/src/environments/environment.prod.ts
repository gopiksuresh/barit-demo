// Production: fill in from Firebase console → Project settings → Your apps (Web app).
// The API is reached via the Firebase Hosting rewrite /api/** → Cloud Function "api".
export const environment = {
  production: true,
  apiBase: '/api/v1',
  useEmulators: false,
  authEmulatorUrl: '',
  firebase: {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME.firebaseapp.com',
    projectId: 'REPLACE_ME',
  },
};
