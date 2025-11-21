// firebaseAdmin.js
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK either from an env var JSON or from local serviceAccountKey.json
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
} else {
  // Make sure serviceAccountKey.json exists locally for dev (do NOT commit it to git)
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

module.exports = admin;
