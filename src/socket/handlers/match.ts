import { Server, Socket } from 'socket.io';
import { prisma } from '../../config';
import { startGameJoinTimer, markPlayerJoined } from '../services/gameService';
import { redis } from '../../config';
import { getGameState } from '../services/gameService';

export const handleMatchStart = async (io: Server, socket: Socket, matchId: string) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId, status: 'ONGOING' },
      include: {
        players: {
          select: {
            id: true,
            username: true,
            rating: true
          }
        }
      }
    });

    if (!match) {
      socket.emit('match_error', { message: 'Match not found' });
      return;
    }

    // Join match room
    const roomId = `match_${matchId}`;
    socket.join(roomId);

    // Mark player as joined
    await markPlayerJoined(matchId, socket.data.userId);

    // Send initial match state
    socket.emit('match_state', {
      matchId: match.id,
      mode: match.mode,
      players: match.players,
      startTime: match.startTime
    });
  } catch (error) {
    console.error('Match start error:', error);
    socket.emit('match_error', { message: 'Failed to start match' });
  }
};

export const handleRejoinMatch = async (io: Server, socket: Socket, matchId: string) => {
  try {
    const userId = socket.data.userId;
    
    const match = await prisma.match.findFirst({
      where: { 
        id: matchId,
        status: 'ONGOING',
        players: {
          some: { id: userId }
        }
      },
      include: {
        players: {
          select: {
            id: true,
            username: true,
            rating: true
          }
        },
        matchQuestions: {
          include: {
            question: {
              include: {
                testCases: true
              }
            }
          }
        }
      }
    });

    if (!match) {
      socket.emit('match_error', { message: 'Match not found or already ended' });
      return;
    }

    // Join match room
    const roomId = `match_${matchId}`;
    socket.join(roomId);

    // Mark player as joined
    await markPlayerJoined(matchId, userId);

    // Send current match state
    socket.emit('match_state', {
      matchId: match.id,
      mode: match.mode,
      players: match.players,
      startTime: match.startTime
    });

    // Clear disconnect timer
    const disconnectKey = `game:${matchId}:disconnect:${socket.data.userId}`;
    await redis.del(disconnectKey);

    // Send game state with problems
    const gameState = await getGameState(matchId);
    const problems = match.matchQuestions.map(mq => ({
      id: mq.question.id,
      title: mq.question.title,
      description: mq.question.description,
      rating: mq.question.rating,
      testCases: mq.question.testCases.filter(tc => !tc.isHidden)
    }));

    socket.emit('game_state', {
      problems,
      gameState: Array.from(gameState.values())
    });

  } catch (error) {
    console.error('Match rejoin error:', error);
    socket.emit('match_error', { message: 'Failed to rejoin match' });
  }
}; 