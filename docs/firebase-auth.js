/* docs/firebase-auth.js
   Social login via Firebase popup -> send idToken to backend
   IMPORTANT:
   - replace FIREBASE_CONFIG below with your Firebase web app config
   - replace BACKEND_URL with your backend HTTPS URL
*/

// Firebase web config (get from Firebase Console > Project settings > Your apps)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYjBkpsYgljPkNaDEbr8cwkzVvNMzLfDc",
  authDomain: "the-mentor-minds-46f88.firebaseapp.com",
  projectId: "the-mentor-minds-46f88",
  // storageBucket, messagingSenderId, appId optional
};

const BACKEND_URL = "https://page-supermolten-tobias.ngrok-free.dev"; // <-- set this

// Initialize Firebase (compat)
if (window.firebase && !window.firebase.apps?.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
const fbAuth = firebase.auth();

// send idToken to backend to create/find user and set refresh cookie
async function sendIdTokenToBackend(idToken) {
  const res = await fetch(BACKEND_URL + "/api/auth/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  // store tokens/user like auth.js
  if (typeof setAccessToken === "function") setAccessToken(data.accessToken);
  localStorage.setItem("mm_user", JSON.stringify(data.user));
  if (typeof renderUserUI === "function") renderUserUI();
  return data.user;
}

async function signInWithGoogleAndSendToBackend() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await fbAuth.signInWithPopup(provider);
    const idToken = await result.user.getIdToken();
    return await sendIdTokenToBackend(idToken);
  } catch (err) {
    console.error("Google sign-in error", err);
    alert("Google sign-in failed: " + (err.message || JSON.stringify(err)));
  }
}

async function signInWithFacebookAndSendToBackend() {
  try {
    const provider = new firebase.auth.FacebookAuthProvider();
    const result = await fbAuth.signInWithPopup(provider);
    const idToken = await result.user.getIdToken();
    return await sendIdTokenToBackend(idToken);
  } catch (err) {
    console.error("Facebook sign-in error", err);
    alert("Facebook sign-in failed: " + (err.message || JSON.stringify(err)));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const gbtn = document.getElementById("googleSignInBtn");
  if (gbtn) gbtn.addEventListener("click", signInWithGoogleAndSendToBackend);
  const fbtn = document.getElementById("facebookSignInBtn");
  if (fbtn) fbtn.addEventListener("click", signInWithFacebookAndSendToBackend);
});
