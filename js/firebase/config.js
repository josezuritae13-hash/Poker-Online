import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAixSuKMcELr4L7WSceh6Ys7WZrb8mAomI",
    authDomain: "poker-online-63d5d.firebaseapp.com",
    databaseURL: "https://poker-online-63d5d-default-rtdb.firebaseio.com",
    projectId: "poker-online-63d5d",
    storageBucket: "poker-online-63d5d.firebasestorage.app",
    messagingSenderId: "1038629656984",
    appId: "1:1038629656984:web:ad13453f7b6529794e73ed",
    measurementId: "G-1RQBBG4JVE"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
