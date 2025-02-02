import { Server, Socket } from 'socket.io';
import { prisma ,redis} from '../../config';
import { Problem, SubmissionResult } from '../types/match';
import { 
  initializeGameState, 
  getGameState, 
  updatePlayerState 
} from '../services/gameService';

export const handleGameStart = async (io: Server, socket: Socket, matchId: string) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true, matchQuestions: true }
    });

    if (!match) {
      socket.emit('game_error', { message: 'Match not found' });
      return;
    }
    const joinKey = `game:${matchId}:joined`;
    const joinedPlayers = await redis.hGetAll(joinKey);
    
    const allPlayersJoined = match.players.every(player => 
      joinedPlayers[player.id] === 'true'
    );

    if (!allPlayersJoined) {
      socket.emit('game_error', { message: 'Waiting for all players to join' });
      return;
    }
    // Initialize game state in Redis
    await initializeGameState(matchId, match.players.map(p => p.id));
    console.log(match)
    const problemIds = match.matchQuestions.map(mq => mq.id);
    const roomId = `match_${matchId}`;
    io.to(roomId).emit('game_start', {
      problems:problemIds,
      gameState: Array.from((await getGameState(matchId)).values())
    });
  } catch (error) {
    console.error('Game start error:', error);
    socket.emit('game_error', { message: 'Failed to start game' });
  }
};

export async function handleGameEnd(io: Server, matchId: string, winnerId: string) {
  try {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'COMPLETED',
        winnerId,
        endTime: new Date()
      },
      include: {
        players: {
          select: {
            id: true,
            rating: true,
            wins: true,
            losses: true,
            matchesPlayed: true
          }
        }
      }
    });

    const winner = match.players.find(p => p.id === winnerId)!;
    const loser = match.players.find(p => p.id !== winnerId)!;
    const ratingChange = calculateRatingChange(
      winner.rating ?? 800, 
      loser.rating ?? 800
    );

    await Promise.all([
      prisma.user.update({
        where: { id: winner.id },
        data: {
          rating: (winner.rating ?? 800) + ratingChange,
          wins: (winner.wins ?? 0) + 1,
          matchesPlayed: (winner.matchesPlayed ?? 0) + 1
        }
      }),
      prisma.user.update({
        where: { id: loser.id },
        data: {
          rating: (loser.rating ?? 800) - ratingChange,
          losses: (loser.losses ?? 0) + 1,
          matchesPlayed: (loser.matchesPlayed ?? 0) + 1
        }
      })
    ]);
    const roomId = `match_${matchId}`;
    io.to(roomId).emit('game_end', {
      winner: winnerId,
      ratingChanges: {
        [winner.id]: ratingChange,
        [loser.id]: -ratingChange
      }
    });

    const gameStateKey = `game:${matchId}:state`;
    await redis.del(gameStateKey);

  } catch (error) {
    console.error('Game end error:', error);
    io.to(`match_${matchId}`).emit('game_error', { message: 'Failed to end game' });
  }
}

function calculateRatingChange(winnerRating: number, loserRating: number): number {
  const K = 32;
  const expectedScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.round(K * (1 - expectedScore));
}

export const handleGetGameState = async (io: Server, socket: Socket, matchId: string) => {
  try {
    const match = await prisma.match.findFirst({
      where: { 
        id: matchId,
        status: 'ONGOING',
        players: { some: { id: socket.data.userId } }
      },
      include: { 
        matchQuestions: true
      }
    });

    if (!match) {
      socket.emit('game_error', { message: 'Match not found or ended' });
      return;
    }

    const gameState = await getGameState(matchId);

    socket.emit('game_state', {
      problems: match.matchQuestions,
      gameState: Array.from(gameState.values())
    });
  } catch (error) {
    console.error('Get game state error:', error);
    socket.emit('game_error', { message: 'Failed to get game state' });
  }
};

export const handlePlayerDisconnect = async (io: Server, socket: Socket) => {
  try {
    const match = await prisma.match.findFirst({
      where: {
        status: 'ONGOING',
        players: { some: { id: socket.data.userId } }
      },
      include: {
        players: true
      }
    });

    if (!match) return;

    const roomId = `match_${match.id}`;
    const disconnectKey = `game:${match.id}:disconnect:${socket.data.userId}`;
    
    // Notify other players immediately
    io.to(roomId).emit('player_disconnected', {
      playerId: socket.data.userId,
      reconnectTimeout: 60
    });

    // Set Redis key with 60s expiry
    await redis.set(disconnectKey, 'true', {
      EX: 65  // 65 seconds to ensure our check works
    });

    // Create a single check after 60 seconds
    setTimeout(async () => {
      try {
        // Get fresh match data and check Redis in parallel
        const [currentMatch, isDisconnected] = await Promise.all([
          prisma.match.findFirst({
            where: {
              id: match.id,
              status: 'ONGOING'
            }
          }),
          redis.get(disconnectKey)
        ]);

        if (isDisconnected && currentMatch) {
          const winner = match.players.find(p => p.id !== socket.data.userId);
          
          if (winner) {
            // Notify about abandonment first
            io.to(roomId).emit('player_abandoned', {
              playerId: socket.data.userId
            });

            // Use handleGameEnd for proper rating updates and cleanup
            await handleGameEnd(io, match.id, winner.id);

            // Additional cleanup
            await redis.del(disconnectKey);
          }
        }
      } catch (error) {
        console.error('Abandonment check error:', error);
      }
    }, 60000);

  } catch (error) {
    console.error('Disconnect handler error:', error);
  }
}; 
