import { Server } from 'http';
import { Client } from 'pg';

export const gracefulShutdown = (server: Server,prismaClient:Client) => {
  console.log('Received kill signal, shutting down gracefully');
  
  return new Promise<void>((resolve, reject) => {
    server.close(async (err) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        reject(err);
        return;
      }

      console.log('Closed out remaining connections');
      
      try {
        await prismaClient.end();
        console.log('Database connections closed');
        resolve();
        process.exit(0);
      } catch (error) {
        console.error('Error closing database:', error);
        reject(error);
        process.exit(1);
      }
    });
  });
};