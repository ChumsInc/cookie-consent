import type {Request, Response} from 'express';
import type {Debugger} from "debug";

export function notFoundHandler(debug: Debugger) {
    return (req: Request, res: Response) => {
        debug('404 Not Found', req.originalUrl);
        res.json({
            error: `404 Not Found`,
            message: `Cannot ${req.method} ${req.originalUrl}`
        });
    }
}
