import { Server } from 'socket.io';

let io = null;
const userSockets = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    socket.on('register_user', (userId) => {
      socket.userId = userId;
      userSockets.set(userId, socket);
      console.log(`User ${userId} registered socket: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        userSockets.delete(socket.userId);
        console.log(`User ${socket.userId} socket disconnected`);
      }
    });
  });

  return io;
};

export const getIO = () => io;
export const getUserSocket = (userId) => userSockets.get(userId);
