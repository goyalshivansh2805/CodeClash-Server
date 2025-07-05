import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import { prisma } from '../config';

export const verifySocketToken = async (
  socket: Socket,
  next: (err?: ExtendedError | undefined) => void
) => {
  try {
    const token = socket.handshake.query.token as string;
    if (!token) {
      throw new Error('Authentication error');
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
      userId: string;
      version: number;
    };

    const [user] = await Promise.all([
      prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
        version: true,
        rating: true
      }
    }),
    ]);
    if (!user || user.version !== decoded.version) {
      throw new Error('Authentication error');
    }

    socket.data.userId = user.id;
    socket.data.rating = user.rating;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
}; 