import { Socket } from 'socket.io';
import { removeFromQueue } from '../services/matchmakingService';

export const handleDisconnect = (socket: Socket) => {
  const userId = socket.data.userId;
  removeFromQueue(userId, socket.data.mode);
}; 