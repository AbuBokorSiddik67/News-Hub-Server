const admin = require('firebase-admin');
const path = require('path');

// Dynamically resolve the path to the service account key
const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');

// Check if Firebase app is already initialized to prevent errors on hot-reloading
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath))
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    // You might want to throw an error or exit process here in production if this fails
  }
} else {
  // If already initialized, use the existing app instance
  admin.app();
}

module.exports = admin; // Export the initialized admin object