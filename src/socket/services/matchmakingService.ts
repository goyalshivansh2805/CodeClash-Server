import { Server, Socket } from 'socket.io';
import { prisma } from '../../config';
import { MatchMode } from '@prisma/client';
import { redis } from '../../config/redis';
import { startGameJoinTimer } from './gameService';
import { Problem } from '../types/match';
import { getMatchProblems } from './getProblems';

const RATING_RANGE = 200;
const QUEUE_CHECK_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_TIME = 30000; // 30 seconds

export interface QueuedPlayer {
  userId: string;
  rating: number;
  socketId: string;
  mode: MatchMode;
  queueTime: number;
}

export const addToQueue = async (player: QueuedPlayer) => {
  const queueKey = `matchmaking:${player.mode}`;
  await redis.hSet(queueKey, player.userId, JSON.stringify(player));
};

export const removeFromQueue = async (userId: string, mode: MatchMode) => {
  const queueKey = `matchmaking:${mode}`;
  await redis.hDel(queueKey, userId);
};

export const findMatch = async (io: Server, socket: Socket) => {
  try {
    const mode = socket.data.mode;
    const userId = socket.data.userId;
    const queueKey = `matchmaking:${mode}`;
    //console.log('Queue key:', queueKey);
    //console.log('User ID:', userId);

    // Get current player from queue
    const playerData = await redis.hGet(queueKey, userId);
    //console.log('Player data:', playerData);
    if (!playerData) return;

    const player = JSON.parse(playerData) as QueuedPlayer;
    const now = Date.now();
    const queueTime = now - player.queueTime;

    // Check timeout first
    if (queueTime >= MAX_QUEUE_TIME) {
      //console.log('Player timed out:', player.userId);
      await removeFromQueue(player.userId, player.mode);
      socket.emit('matchmaking_timeout');
      return;
    }

    // Calculate adjusted rating range based on queue time
    const adjustedRange = RATING_RANGE + Math.floor(queueTime / 1000) * 10;

    // Get all players in queue
    const queuedPlayers = await redis.hGetAll(queueKey);
    
    // Find suitable opponent
    const opponent = Object.values(queuedPlayers)
      .map(p => JSON.parse(p) as QueuedPlayer)
      .find(p => 
        p.userId !== player.userId && 
        Math.abs(p.rating - player.rating) <= adjustedRange &&
        p.mode === player.mode
      );

    if (opponent) {
      //console.log('Match found between', player.userId, 'and', opponent.userId);
      
      // Remove both players from queue
      await Promise.all([
        removeFromQueue(player.userId, player.mode),
        removeFromQueue(opponent.userId, opponent.mode)
      ]);

      try {
        const problems: Problem[] = await getMatchProblems(player.mode);
        // console.log(problems);
        const match = await prisma.match.create({
          data: {
            mode: player.mode,
            status: 'ONGOING',
            startTime: new Date(),
            players: {
              connect: [
                { id: player.userId },
                { id: opponent.userId }
              ]
            },
            matchQuestions: {
              connect: problems.map(p => ({
                id: p.id
              }))
            }
          }
        });

        const roomId = `match_${match.id}`;

        // Get sockets for both players
        const [playerSocket, opponentSocket] = await Promise.all([
          io.sockets.sockets.get(player.socketId),
          io.sockets.sockets.get(opponent.socketId)
        ]);

        if (!playerSocket || !opponentSocket) {
          throw new Error('Player socket not found');
        }

        // Join both players to match room
        await Promise.all([
          playerSocket.join(roomId),
          opponentSocket.join(roomId)
        ]);

        // Start join timer after match is created
        await startGameJoinTimer(io, match.id, [player.userId, opponent.userId]);

        // Notify both players
        io.to(roomId).emit('match_found', {
          matchId: match.id,
          players: [player.userId, opponent.userId]
        });

      } catch (error) {
        console.error('Error creating match:', error);
        io.to(player.socketId).emit('matchmaking_error', { message: 'Failed to create match' });
        io.to(opponent.socketId).emit('matchmaking_error', { message: 'Failed to create match' });
      }
    } else {
      // Schedule next check
      setTimeout(() => findMatch(io, socket), QUEUE_CHECK_INTERVAL);
    }
  } catch (error) {
    console.error('Error in findMatch:', error);
    socket.emit('matchmaking_error', { message: 'Matchmaking error occurred' });
  }
};

const checkOngoingMatch = async (userId: string) => {
  const ongoingMatch = await prisma.match.findFirst({
    where: {
      players: {
        some: { id: userId }
      },
      status: 'ONGOING'
    }
  });
  return ongoingMatch;
};

export const createMatch = async (player1: QueuedPlayer, player2: QueuedPlayer) => {
  
  const [player1Match, player2Match] = await Promise.all([
    checkOngoingMatch(player1.userId),
    checkOngoingMatch(player2.userId)
  ]);

  if (player1Match) {
    throw new Error(`Player ${player1.userId} is already in an ongoing match`);
  }

  if (player2Match) {
    throw new Error(`Player ${player2.userId} is already in an ongoing match`);
  }

  console.log('Creating match with mode:', player1.mode);
  
  return await prisma.match.create({
    data: {
      mode: player1.mode,
      status: 'ONGOING',
      startTime: new Date(),
      players: {
        connect: [
          { id: player1.userId },
          { id: player2.userId }
        ]
      }
    }
  });
}; 
