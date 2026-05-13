import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC3jEzg7uujE-Qcr2cWPJFRYiII9wu72Ow",
  authDomain: "starrummy-9e62c.firebaseapp.com",
  projectId: "starrummy-9e62c",
  storageBucket: "starrummy-9e62c.appspot.com",
  messagingSenderId: "910373424999",
  appId: "1:910373424999:web:f32a06b0ac86b8d3c929c2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);