import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logRequests = (req: Request, res: Response, next: NextFunction) => {
    const { method, url, ip } = req;
    const origin = req.headers.origin || 'unknown';
    const log = `${method} ${url} ${origin} ${new Date().toISOString()} ${ip}\n`;
    const logsDir = path.join(__dirname, '../logs');
    const logFilePath = path.join(logsDir, 'requests.txt');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true }); 
    }
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, ''); 
    }
    fs.appendFile(logFilePath, log, (err) => {
        if (err) {
            console.log(err);
        }
    });
    next();
}

export default logRequests;
