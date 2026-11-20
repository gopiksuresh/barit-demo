// Local development: Firebase Auth emulator + API via the dev-server proxy.
export const environment = {
  production: false,
  apiBase: '/api/v1',
  useEmulators: true,
  authEmulatorUrl: 'http://127.0.0.1:9099',
  // "demo-" project ids work with the emulator without a real Firebase project.
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-barit.firebaseapp.com',
    projectId: 'demo-barit',
  },
};
