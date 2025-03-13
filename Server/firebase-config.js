const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json"); // 🔥 Ensure this file is in .gitignore

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

module.exports = { db, admin };
