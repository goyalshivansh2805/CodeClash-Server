import express, { NextFunction, Request, Response } from 'express';
import {connectDB} from './config/prisma';
import cors from 'cors';
import {logRequest} from './middlewares';
import {default as primaryRouter} from './routes/route';
import { CustomError } from './types';
import {errorHandler} from './middlewares';

const app = express();
const PORT : number = Number(process.env.PORT) || 3000;

app.use(logRequest);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', primaryRouter);


app.use('*', (req: Request, res: Response,next:NextFunction) => {
  const error = new CustomError('Resource not found!!!!', 404);
  next(error);
});

app.use(errorHandler);


connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
