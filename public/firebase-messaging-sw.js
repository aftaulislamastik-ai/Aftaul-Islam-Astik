importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAMZADPBlUjE3etpwWjRBtTecLwFL8WqG4",
  authDomain: "commune-chat-844d8.firebaseapp.com",
  projectId: "commune-chat-844d8",
  storageBucket: "commune-chat-844d8.firebasestorage.app",
  messagingSenderId: "778335467890",
  appId: "1:778335467890:web:2feff5e97e82d5f8a045eb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
