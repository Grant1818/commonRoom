const socket = io();

const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const joinError = document.getElementById('join-error');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('user-list');
const userCountEl = document.getElementById('user-count');

let myName = null;

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Uses textContent (never innerHTML) so nobody can inject HTML/scripts
function addMessage(msg) {
  const li = document.createElement('li');
  if (msg.type === 'system') {
    li.className = 'system';
    li.textContent = msg.text;
  } else {
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${msg.name} · ${formatTime(msg.time)}`;
    const body = document.createElement('span');
    body.className = 'body';
    body.textContent = msg.text;
    li.append(meta, body);
    if (msg.name === myName) li.classList.add('mine');
  }
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function tryJoin(name) {
  socket.emit('join', name, (res) => {
    if (!res.ok) {
      myName = null;
      joinError.textContent = res.error;
      chatScreen.hidden = true;
      joinScreen.hidden = false;
      return;
    }
    myName = res.name;
    joinError.textContent = '';
    joinScreen.hidden = true;
    chatScreen.hidden = false;
    messagesEl.innerHTML = '';
    res.history.forEach(addMessage);
    messageInput.focus();
  });
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  tryJoin(nameInput.value);
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('message', text);
  messageInput.value = '';
});

socket.on('chat', addMessage);

socket.on('users', (names) => {
  userCountEl.textContent = names.length;
  userListEl.innerHTML = '';
  names.forEach((n) => {
    const li = document.createElement('li');
    li.textContent = n;
    userListEl.appendChild(li);
  });
});

// If the connection drops and comes back, rejoin automatically
socket.on('connect', () => {
  if (myName) tryJoin(myName);
});