import { Router, Request, Response } from 'express';

const router = Router();

const operators = [
            {
                id: "cmet",
                displayName: "Carris Metropolitana",
                color: "#ffdd00"
            },
            {
                id: "cp",
                displayName: "Comboios de Portugal",
                color: "#268b4f"

            },
            {
                id: "ml",
                displayName: "Metropolitano de Lisboa",
                color: "#cd0836"
            },
            {
                id: "mts",
                displayName: "Metro Transportes do Sul",
                color: "#15387a"
            },
            {
                id: "fertagus",
                displayName: "Fertagus",
                color: "#05588c"
            },
            {
                id: "carris",
                displayName: "Carris",
                color: "#d4a423"
            }
        ]

router.get('/', (_req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json(operators);
});

export { operators };
export default router;
