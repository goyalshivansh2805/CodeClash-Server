import { Server, Socket } from 'socket.io';
import { prisma } from '../../config';
import { redis } from '../../config/redis';
import { Problem, PlayerState } from '../types/match';

const GAME_JOIN_TIMEOUT = 60000; // 1 minute

export const startGameJoinTimer = async (io: Server, matchId: string, players: string[]) => {
  // Store join status in Redis
  const joinKey = `game:${matchId}:joined`;
  const playerStatuses = Object.fromEntries(players.map(id => [id, 'false']));
  await redis.hSet(joinKey, playerStatuses);
  
  // Set expiry for cleanup
  await redis.expire(joinKey, 120); // 2 minutes

  // Start timeout
  setTimeout(async () => {
    const joinStatus = await redis.hGetAll(joinKey);
    const notJoined = Object.entries(joinStatus)
      .filter(([_, status]) => status === 'false')
      .map(([id]) => id);

    if (notJoined.length > 0) {
      // Some players didn't join
      const winner = players.find(id => !notJoined.includes(id));
      
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'ABORTED',
          winnerId: winner,
          endTime: new Date(),
          abortedById: notJoined[0]
        }
      });

      io.to(`match_${matchId}`).emit('match_aborted', {
        reason: 'Player failed to join',
        winner,
        abortedBy: notJoined[0]
      });
    }

    // Cleanup
    await redis.del(joinKey);
  }, GAME_JOIN_TIMEOUT);
};

export const markPlayerJoined = async (matchId: string, userId: string) => {
  const joinKey = `game:${matchId}:joined`;
  await redis.hSet(joinKey, userId, 'true');
};

export const initializeGameState = async (matchId: string, players: string[]) => {
  const gameStateKey = `game:${matchId}:state`;
  
  const playerStates = players.reduce((acc, playerId) => ({
    ...acc,
    [playerId]: JSON.stringify({
      userId: playerId,
      problemsSolved: 0,
      solvedProblems: []
    })
  }), {});

  await redis.hSet(gameStateKey, playerStates);
  await redis.expire(gameStateKey, 3600); // 1 hour expiry
};

export const getGameState = async (matchId: string): Promise<Map<string, PlayerState>> => {
  const gameStateKey = `game:${matchId}:state`;
  const rawState = await redis.hGetAll(gameStateKey);
  
  return new Map(
    Object.entries(rawState).map(([userId, state]) => {
      const parsed = JSON.parse(state);
      return [userId, {
        ...parsed,
        solvedProblems: new Set(parsed.solvedProblems)
      }];
    })
  );
};

export const updatePlayerState = async (
  matchId: string, 
  userId: string, 
  update: Partial<PlayerState>
) => {
  const gameStateKey = `game:${matchId}:state`;
  const currentState = JSON.parse(await redis.hGet(gameStateKey, userId) || '{}');
  
  // Check if problem is already solved
  const solvedProblems = new Set(currentState.solvedProblems || []);
  if (update.solvedProblems) {
    const newProblem = Array.from(update.solvedProblems)[0];
    if (!solvedProblems.has(newProblem)) {
      solvedProblems.add(newProblem);
      // Only increment if problem wasn't already solved
      update.problemsSolved = solvedProblems.size;
    } else {
      // If problem was already solved, keep existing count
      update.problemsSolved = currentState.problemsSolved;
    }
  }

  const newState = {
    ...currentState,
    ...update,
    solvedProblems: Array.from(solvedProblems)
  };

  await redis.hSet(gameStateKey, userId, JSON.stringify(newState));
  return newState;
}; 

export function calculateRatingChange(winnerRating: number, loserRating: number): number {
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