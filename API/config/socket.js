const { Server } = require('socket.io');
let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] },
  });
  io.on('connection', (socket) => {
    socket.on('join', (room) => { if (room) socket.join(room); });
    socket.on('leave', (room) => { if (room) socket.leave(room); });
  });
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

function emit(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

function emitTo(room, event, payload) {
  if (!io) return;
  io.to(String(room)).emit(event, payload);
}

module.exports = { initSocket, getIO, emit, emitTo };
