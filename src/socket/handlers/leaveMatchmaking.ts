import { Socket } from 'socket.io';
import { removeFromQueue } from '../services/matchmakingService';

export const handleLeaveMatchmaking = (socket: Socket) => {
  const userId = socket.data.userId;
  socket.leave('matchmaking');
  removeFromQueue(userId, socket.data.mode);
};  