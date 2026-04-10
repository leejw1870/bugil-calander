/* ================================
   Firebase Configuration & Init
   ================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCB7AW9dqVZ2yZ5vAUWwUjI5bZzL7s__CI",
    authDomain: "bugil-calander.firebaseapp.com",
    projectId: "bugil-calander",
    storageBucket: "bugil-calander.firebasestorage.app",
    messagingSenderId: "951592697754",
    appId: "1:951592697754:web:2a26a468b24e289bc78423"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
