import { Router, Request, Response } from 'express';
import { Departure, StopTimeEntry } from '../types/interfaces';
import * as cp from '../modules/CPModule2';
import * as mts from '../modules/MTSModule';
import * as ml from '../modules/MLModule2';
import * as fertagus from '../modules/FertagusModule';
import * as carris from '../modules/CarrisModule';
import { cmetModule} from './stops';
import { operators } from './areas';
import { log_request } from '../utils';

const router = Router();

const NUM_RESULTS = 50;
const [CMET, CP, ML, MTS, FERTAGUS, CARRIS] = operators.map((a) => a.id);

async function getDepartures(
    operator: string,
    stop_ids: string[],
    limit: number,
): Promise<Departure[]> {
    switch (operator) {
        case CARRIS:
            return carris.get_departures_stopId(stop_ids, limit);
        case FERTAGUS:
            return fertagus.get_departures_stopId(stop_ids, limit);
        case CMET:
            return cmetModule.get_departures_stopId(stop_ids, limit);
        case CP:
            return cp.get_departures_stopId(stop_ids, limit);
            //return cp.get_departures(stop_name, limit, giventime);
        case MTS:
            return mts.get_departures_stopId(stop_ids, limit);
        case ML:
            return ml.get_departures(stop_ids, limit);
        default:
            return [];
    }
}

router.get('/:operator/:stop_ids/departures', (req: Request, res: Response) => {
    const { stop_ids, operator } = req.params;
    const limit = !isNaN(Number(req.query.limit)) ? Number(req.query.limit) : NUM_RESULTS;

    res.header('Access-Control-Allow-Origin', '*');
    log_request(operator + "2", stop_ids, req.ip ?? '');

    getDepartures(operator, stop_ids.split(","), limit).then((data) =>
        res.json(data)
    );
});

export default router;
