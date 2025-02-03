import { CustomRequest, CustomError } from "../../types";
import { prisma } from "../../config";
import { NextFunction, Response } from "express";
import { formatDistance, format } from 'date-fns';
import { MatchMode } from "@prisma/client";

const getLeaderboard = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if(!userId){
            next(new CustomError("User not found", 404));
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const [leaderboard, totalCount,userRank] = await prisma.$transaction([
            prisma.user.findMany({
                orderBy: {
                    wins: 'desc'
                },
                select:{
                    id:true,
                    username:true,
                    wins:true
                },
                skip,
                take: limit
            }),
            prisma.user.count(),
            prisma.user.count({
                where: {
                    wins: {
                        gt: user.wins || 0
                    }
                }
            })
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        res.status(200).json({
            success: true,
            leaderboard,
            userRank: userRank + 1,
            pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit
            }
        });

        
    }catch(error){
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}


const getRecentMatches = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        let mode = req.query.mode as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        if(!userId){
            next(new CustomError("User not found", 404));
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const [recentMatches, totalCount,winsCount] = await prisma.$transaction([
            prisma.match.findMany({
                where: {
                    players: {
                        some: {
                        id: userId
                    }
                },
                ...(mode ? { mode: mode as MatchMode } : {})
                ,status:"COMPLETED"

            },
            select:{
                players: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                mode: true,
                createdAt: true,
                status: true,
                winnerId: true,
                abortedById: true,
                endTime: true,
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
                take: limit 
            }),
            prisma.match.count({
                where: {
                    players: {
                        some: {
                            id: userId
                        }
                    },
                    ...(mode ? { mode: mode as MatchMode } : {}),
                    status: "COMPLETED"
                }
            }),
            prisma.match.count({
                where: {
                    winnerId: userId,
                    ...(mode ? { mode: mode as MatchMode } : {}),
                    status: "COMPLETED"
                }
            })
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        const formattedMatches = recentMatches.map(match => ({
            ...match,
            createdAt: format(new Date(match.createdAt), 'dd/MM/yyyy'),
            duration: match.endTime && match.createdAt ? 
                formatDistance(new Date(match.createdAt), new Date(match.endTime), { includeSeconds: true }) : 
                null
        }));
        res.status(200).json({
            success: true,
            recentMatches: formattedMatches,
            winsCount,
            lossesCount: totalCount - winsCount,
            totalMatches: totalCount,
            pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

const getWinTrend = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if(!userId){
            next(new CustomError("User not found", 404));
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const matches = await prisma.match.findMany({
            where: {
                players: {
                    some: { id: userId }
                },
                status: 'COMPLETED',
                endTime: {
                    gte: sevenDaysAgo
                },
            },
            select: {
                endTime: true,
                winnerId: true,
                mode: true
            },
            orderBy: {
                endTime: 'asc'
            }
        });

        const trend = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayMatches = matches.filter(m => 
                format(new Date(m.endTime!), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
            );
            
            return {
                date: format(date, 'dd/MM/yyyy'),
                wins: dayMatches.filter(m => m.winnerId === userId).length,
                losses: dayMatches.filter(m => m.winnerId && m.winnerId !== userId).length
            };
        }).reverse();

        res.status(200).json({
            success: true,
            trend,
            winStreak: user.winStreak,
            maxWinStreak: user.maxWinStreak
        });

    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

export { getLeaderboard, getRecentMatches, getWinTrend };