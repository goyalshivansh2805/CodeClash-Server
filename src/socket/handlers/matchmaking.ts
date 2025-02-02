import { Server, Socket } from 'socket.io';
import { prisma } from '../../config';
import { MatchMode } from '@prisma/client';
import { addToQueue, removeFromQueue, findMatch } from '../services/matchmakingService';

export const handleMatchmaking = async (io: Server, socket: Socket, data: { mode: MatchMode }) => {
  try {
    if(typeof data === 'string'){
      data=JSON.parse(data);
    }
    const mode = data.mode; 
    const { userId, rating } = socket.data;
    console.log(mode);
    if (!mode) {
      socket.emit('matchmaking_error', { message: 'Mode is required' });
      return;
    }
    if(!Object.values(MatchMode).includes(mode)){
      socket.emit('matchmaking_error', { message: 'Invalid mode' });
      return;
    }

    const ongoingMatch = await prisma.match.findFirst({
      where: {
        players: {
          some: { id: userId }
        },
        status: 'ONGOING'
      }
    });

    // if (ongoingMatch) {
    //   socket.emit('matchmaking_error', { message: 'You are already in an ongoing match' });
    //   return;
    // }
    socket.data.mode = mode;
    await removeFromQueue(userId, mode);

    await addToQueue({
      userId,
      rating,
      socketId: socket.id,
      mode,
      queueTime: Date.now()
    });

    socket.emit('matchmaking_status', { status: 'queued' });
    findMatch(io, socket);
  } catch (error) {
    console.error('Matchmaking error:', error);
    socket.emit('matchmaking_error', { message: 'Failed to join matchmaking' });
  }
}; 