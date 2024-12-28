import express,{Request,Response} from 'express';
import { Server } from 'http';
import { connectDB } from './config/prisma';
import { gracefulShutdown } from './utils/shutdown';

const app = express();
const port = process.env.PORT || 3000;
let server: Server;

async function startServer() {
  try {
    const dbClient = await connectDB();
    
    app.get('/health', (req:Request, res:Response) => {
      res.json({ 
        status: 'ok',
        timestamp: new Date(),
        database: 'connected hii'
      });
    });

    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    process.on('SIGTERM', () => gracefulShutdown(server, dbClient));
    process.on('SIGINT', () => gracefulShutdown(server,dbClient));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();