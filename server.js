import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- Profanity filter (runs on the server, so it can't be bypassed) ---
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
const censor = new TextCensor();
function clean(text) {
  return censor.applyTo(text, matcher.getAllMatches(text));
}

// --- State (lives in memory; resets when the server restarts) ---
const users = new Map(); // socket.id -> display name
const history = [];      // last 50 messages
const MAX_HISTORY = 50;

function addToHistory(msg) {
  history.push(msg);
  if (history.length > MAX_HISTORY) history.shift();
}

function announce(text) {
  const msg = { type: 'system', text, time: Date.now() };
  addToHistory(msg);
  io.emit('chat', msg);
}

io.on('connection', (socket) => {
  // A visitor tries to join with a name
  socket.on('join', (rawName, ack) => {
    if (typeof ack !== 'function') return;
    if (users.has(socket.id)) return ack({ ok: false, error: 'Already joined.' });

    const name = String(rawName ?? '').trim().slice(0, 20);
    if (!name) return ack({ ok: false, error: 'Please enter a name.' });
    if (matcher.hasMatch(name)) return ack({ ok: false, error: 'Please choose a different name.' });
    const taken = [...users.values()].some((n) => n.toLowerCase() === name.toLowerCase());
    if (taken) return ack({ ok: false, error: 'That name is already in use.' });

    users.set(socket.id, name);
    ack({ ok: true, name, history });
    io.emit('users', [...users.values()]);
    announce(`${name} joined`);
  });

  // A visitor sends a message
  socket.on('message', (text) => {
    const name = users.get(socket.id);
    if (!name) return;
    const body = String(text ?? '').trim().slice(0, 300);
    if (!body) return;

    const msg = { type: 'user', name, text: clean(body), time: Date.now() };
    addToHistory(msg);
    io.emit('chat', msg);
  });

  // A visitor closes the tab or loses connection
  socket.on('disconnect', () => {
    const name = users.get(socket.id);
    if (!name) return;
    users.delete(socket.id);
    io.emit('users', [...users.values()]);
    announce(`${name} left`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Common Room running on port ${PORT}`));