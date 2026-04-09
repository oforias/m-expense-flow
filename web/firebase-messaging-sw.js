// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBvOkBread2PmiGImtABqKcNUeWhZsI0Ag",
  authDomain: "expense-flow-2e9f7.firebaseapp.com",
  projectId: "expense-flow-2e9f7",
  storageBucket: "expense-flow-2e9f7.firebasestorage.app",
  messagingSenderId: "237484140476",
  appId: "1:237484140476:web:4aae0a2e4e2a4e2a4e2a4e"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/Icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});