import express, { NextFunction, Request, Response,json,urlencoded } from 'express';
import {connectDB} from './config/prisma';
import cors from 'cors';
import {logRequest,errorHandler} from './middlewares';
import {primaryRouter} from './routes';
import {CustomError} from './types';

const app = express();
const PORT : number = Number(process.env.PORT) || 3000;

app.use(logRequest);
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
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
