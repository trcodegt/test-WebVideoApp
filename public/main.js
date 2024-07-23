import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, update } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCb4vzJAm4fpA-fIF1S17ywYMKX3i9Yvgw",
  authDomain: "testfocusvideoapp.firebaseapp.com",
  databaseURL: "https://testfocusvideoapp-default-rtdb.firebaseio.com",
  projectId: "testfocusvideoapp",
  storageBucket: "testfocusvideoapp.appspot.com",
  messagingSenderId: "39660109111",
  appId: "1:39660109111:web:526283adab5f3c0adbaeb2",
  measurementId: "G-M251NQY9Y9"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth();
const storage = getStorage(app);

let currentUser = null;
let currentChatUser = null;
let pc = null; 

document.getElementById('loginButton').onclick = async () => {
  const nickname = document.getElementById('nickname').value;
  const avatar = document.getElementById('avatar').files[0];

  if (nickname && avatar) {
    try {
      await signInAnonymously(auth);
      const user = auth.currentUser;
      const avatarStorageRef = storageRef(storage, `avatars/${user.uid}`);
      await uploadBytes(avatarStorageRef, avatar);
      const avatarURL = await getDownloadURL(avatarStorageRef);

      await set(ref(database, 'users/' + user.uid), {
        nickname: nickname,
        avatar: avatarURL,
        status: 'available'
      });

      currentUser = user;
      showUserListScreen();
    } catch (error) {
      console.error('Error durante el inicio de sesión anónimo:', error);
      alert('Falló el inicio de sesión anónimo.');
    }
  } else {
    alert('Por favor, ingresa un apodo y selecciona un avatar.');
  }
};

document.getElementById('logoutButton').onclick = async () => {
  if (currentUser) {
    await update(ref(database, 'users/' + currentUser.uid), { status: 'offline' });
    auth.signOut();
  }
  showLoginScreen();
};

const showLoginScreen = () => {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('user-list-screen').style.display = 'none';
  document.getElementById('chat-call-screen').style.display = 'none';
  document.getElementById('videoCallScreen').style.display = 'none';
};

const showUserListScreen = () => {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('user-list-screen').style.display = 'flex';
  document.getElementById('chat-call-screen').style.display = 'none';
  document.getElementById('videoCallScreen').style.display = 'none';

  const userList = document.getElementById('userList');
  userList.innerHTML = '';

  onValue(ref(database, 'users'), (snapshot) => {
    userList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      if (user.status !== 'offline' && childSnapshot.key !== currentUser.uid) {
        const userItem = document.createElement('div');
        userItem.innerHTML = `
          <img src="${user.avatar}" alt="avatar" width="50">
          <span>${user.nickname}</span>
          <span>${user.status}</span>
        `;
        userItem.onclick = () => showChatCallScreen(childSnapshot.key);
        userList.appendChild(userItem);
      }
    });
  });
};

const showChatCallScreen = async (userId) => {
  const userSnapshot = await get(ref(database, 'users/' + userId));
  currentChatUser = {
    ...userSnapshot.val(),
    uid: userId
  };

  if (!currentChatUser) {
    alert('No se pudieron cargar los detalles del usuario.');
    return;
  }

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('user-list-screen').style.display = 'none';
  document.getElementById('chat-call-screen').style.display = 'flex';
  document.getElementById('videoCallScreen').style.display = 'none';

  const userDetails = document.getElementById('userDetails');
  userDetails.innerHTML = `
    <img src="${currentChatUser.avatar}" alt="avatar" width="50">
    <span>${currentChatUser.nickname}</span>
    <span>${currentChatUser.status}</span>
  `;

  document.getElementById('audioCallButton').disabled = currentChatUser.status !== 'available';
  document.getElementById('videoCallButton').disabled = currentChatUser.status !== 'available';

  onValue(ref(database, 'chats'), (snapshot) => {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const message = childSnapshot.val();
      if ((message.sender === currentUser.uid && message.receiver === currentChatUser.uid) ||
          (message.sender === currentChatUser.uid && message.receiver === currentUser.uid)) {
        const messageItem = document.createElement('div');
        messageItem.textContent = message.message;
        chatMessages.appendChild(messageItem);
      }
    });
  });
};

const initiateCall = (type) => {
  if (!currentChatUser) {
    alert('No hay usuario seleccionado para la llamada.');
    return;
  }

  pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      push(ref(database, `calls/${currentChatUser.uid}/candidates`), event.candidate.toJSON());
    }
  };

  pc.ontrack = event => {
    const remoteStream = new MediaStream();
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    document.getElementById('remoteVideo').srcObject = remoteStream;
  };

  const callRef = push(ref(database, 'calls'), {
    caller: currentUser.uid,
    receiver: currentChatUser.uid,
    type: type,
    status: 'ringing'
  });

  onValue(callRef, (snapshot) => {
    const call = snapshot.val();
    if (call.status === 'answered') {
      startCall(call.type);
    }
  });

  setTimeout(() => {
    if (confirm(`${currentChatUser.nickname} está llamándote.`)) {
      update(callRef, { status: 'answered' });
      document.getElementById('videoCallScreen').style.display = 'flex';

    } else {
      update(callRef, { status: 'declined' });
    }
  }, 3000);
};

const startCall = async (type) => {
  document.getElementById('videoCallScreen').style.display = 'flex';
  // document.getElementById('chat-call-screen').style.display = 'none';

  const localStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  update(ref(database, `calls/${currentChatUser.uid}`), { offer });

  onValue(ref(database, `calls/${currentChatUser.uid}/candidates`), (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const candidate = new RTCIceCandidate(childSnapshot.val());
      pc.addIceCandidate(candidate);
    });
  });

  onValue(ref(database, `calls/${currentChatUser.uid}`), (snapshot) => {
    const call = snapshot.val();
    if (call && call.answer) {
      const answerDesc = new RTCSessionDescription(call.answer);
      pc.setRemoteDescription(answerDesc);
    }
  });
};

document.getElementById('sendChatButton').onclick = () => {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value;

  if (message) {
    push(ref(database, 'chats'), {
      sender: currentUser.uid,
      receiver: currentChatUser.uid,
      message: message,
      timestamp: Date.now()
    });
    chatInput.value = '';
  }
};

document.getElementById('endCallButton').onclick = () => {
  endCall();
};

const endCall = () => {
  document.getElementById('videoCallScreen').style.display = 'none';
  document.getElementById('chat-call-screen').style.display = 'flex';
  if (pc) {
    pc.close();
    pc = null;
  }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showUserListScreen();
  } else {
    showLoginScreen();
  }
});

document.getElementById('audioCallButton').onclick = () => initiateCall('audio');
document.getElementById('videoCallButton').onclick = () => initiateCall('video');
