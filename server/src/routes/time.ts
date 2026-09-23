import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
    const now = new Date();
    res.json({
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
    });
});

export default router;
