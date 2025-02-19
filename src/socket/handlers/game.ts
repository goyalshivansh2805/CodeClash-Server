import { Server, Socket } from 'socket.io';
import { prisma ,redis} from '../../config';
import { 
  initializeGameState, 
  getGameState, 
  calculateRatingChange
} from '../services/gameService';
import { Skill } from '@prisma/client';

const LEVEL_RATINGS = {
  BEGINNER: 800,
  INTERMEDIATE: 1200,
  PRO:1600
};


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

function getSkillLevel(rating: number): Skill {
  if (rating < LEVEL_RATINGS.INTERMEDIATE) return 'BEGINNER';
  if (rating < LEVEL_RATINGS.PRO) return 'INTERMEDIATE';
  return 'PRO';
}

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
            matchesPlayed: true,
            winStreak: true,
            maxWinStreak: true
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
          matchesPlayed: (winner.matchesPlayed ?? 0) + 1,
          winStreak: (winner.winStreak ?? 0) + 1,
          maxWinStreak: ((winner.winStreak ?? 0) + 1) > (winner.maxWinStreak ?? 0) ? ((winner.winStreak ?? 0) + 1) : (winner.maxWinStreak ?? 0),
          skillLevel: getSkillLevel((winner.rating ?? 800) + ratingChange)
        }
      }),
      prisma.user.update({
        where: { id: loser.id },
        data: {
          rating: (loser.rating ?? 800) - ratingChange,
          losses: (loser.losses ?? 0) + 1,
          matchesPlayed: (loser.matchesPlayed ?? 0) + 1,
          winStreak:0,
          maxWinStreak: (loser.winStreak ?? 0 ) > (loser.maxWinStreak ?? 0) ? (loser.winStreak ?? 0 ) : (loser.maxWinStreak ?? 0),
          skillLevel: getSkillLevel((loser.rating ?? 800) - ratingChange)
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
