import { Router, Request, Response } from 'express';
import { StopTimeEntry } from '../types/interfaces';
import * as cp from '../modules/CPModule';
import * as mts from '../modules/MTSModule';
import * as ml from '../modules/MLModule';
import { cmetModule } from './stops';
import { operators } from './areas';
import { log_request } from '../utils';

const router = Router();

const NUM_RESULTS = 10;
const [CMET, CP, ML, MTS, FERTAGUS] = operators.map((a) => a.id);

async function getDepartures(   
    operator: string,
    stop_name: string,
    limit: number,
    giventime?: string
): Promise<StopTimeEntry[]> {
    console.log(`Getting departures for operator: ${operator}, stop: ${stop_name}, limit: ${limit}, time: ${giventime}`);
    switch (operator) {
        case FERTAGUS:
             console.log("FERTAGUS: Getting departures for station: " + stop_name); 
            //return fertagusModule.get_departures(stop_name, limit, giventime);
        case CMET:
                console.log("CMET: Getting departures for station: " + stop_name);
           // return cmetModule.get_cmet(stop_name, limit, undefined, giventime);
        case CP:
                console.log("CP: Getting departures for station: " + stop_name);
            return cp.get_departures(stop_name, limit, giventime);
        case MTS:
            console.log("MTS: Getting departures for station: " + stop_name);
            return []//mts.get_departures(stop_name, limit, giventime);
        case ML:
            
            console.log("Getting departures for station: " + stop_name);
            return ml.get_departures(stop_name, limit);
        default:
            return [];
    }
}

router.get('/:operator/:stop_name/departures', (req: Request, res: Response) => {
    const { stop_name, operator } = req.params;
    const limit = !isNaN(Number(req.query.limit)) ? Number(req.query.limit) : NUM_RESULTS;

    res.header('Access-Control-Allow-Origin', '*');
    log_request(operator, stop_name, req.ip ?? '');

    getDepartures(operator, stop_name, limit, req.query.time as string | undefined).then((data) =>
        res.json(data)
    );
});

export default router;
