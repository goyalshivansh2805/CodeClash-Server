import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifySocketToken } from '../middlewares/verifySocketToken';
import { 
  handleMatchmaking, 
  handleDisconnect, 
  handleLeaveMatchmaking, 
  handleRejoinMatch,
  handleMatchStart,
  handleGameStart,
  handlePlayerDisconnect
} from './handlers';
import { handleGetGameState } from './services/gameService';

let io: SocketServer;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      credentials: true
    },
    transports: ['websocket', 'polling'],
    path: '/socket'
  });

  io.engine.on("connection_error", (err) => {
    console.log(err.req);      
    console.log(err.code);     
    console.log(err.message);  
    console.log(err.context);  
  });

  io.use(verifySocketToken);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join_matchmaking', (data) => {
      console.log('Join matchmaking request:', data);
      handleMatchmaking(io, socket, data);
    });

    socket.on('join_match', (matchId) => {
      console.log('Join match request:', matchId);
      handleMatchStart(io, socket, matchId);
    });

    socket.on('start_game', (matchId) => {
      console.log('Start game request:', matchId);
      handleGameStart(io, socket, matchId);
    });

    socket.on('leave_matchmaking', () => {
      console.log('Leave matchmaking request');
      handleLeaveMatchmaking(socket);
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      await handlePlayerDisconnect(io, socket);
    });

    socket.on('rejoin_match', (matchId) => {
      console.log('Rejoin match request:', matchId);
      handleRejoinMatch(io, socket, matchId);
    });

    socket.on('get_game_state', (matchId) => {
      handleGetGameState(io, socket, matchId);
    });
  });

  return io;
};

export { io }; 