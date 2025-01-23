import express, { NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import { connectDB,connectRedis } from './config';
import cors from 'cors';
import { logRequest, errorHandler } from './middlewares';
import { primaryRouter } from './routes';
import { CustomError } from './types';
import { initializeSocket } from './socket/socket';

const app = express();
const httpServer = createServer(app);
export const io = initializeSocket(httpServer);
const PORT: number = Number(process.env.PORT) || 3000;

app.use(logRequest);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', primaryRouter);

app.use('*', (req: Request, res: Response, next: NextFunction) => {
  next(new CustomError('Resource not found!!!!', 404));
});

app.use(errorHandler);

Promise.all([connectDB(), connectRedis()])
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to connect to databases:', error);
    process.exit(1);
  });
