// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCA6XZBDZnZ4eSTZ-TdvKcIYm_R7gZdFXw",
  authDomain: "camporganizer.firebaseapp.com",
  databaseURL: "https://camporganizer-default-rtdb.firebaseio.com",
  projectId: "camporganizer",
  storageBucket: "camporganizer.firebasestorage.app",
  messagingSenderId: "850656959274",
  appId: "1:850656959274:web:dc5016ec9dc0c5b64f9c53",
  measurementId: "G-PQ2EZW85GB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export Firebase functions
export { db, ref, get, set, update, remove, onValue };
