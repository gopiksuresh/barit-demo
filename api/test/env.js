// Point the API at the test database before any module is loaded.
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.STORAGE_DRIVER = 'local';
