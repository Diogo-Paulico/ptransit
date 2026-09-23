import { Router, Request, Response } from 'express';
import { StopSearchResult } from '../types/interfaces';
import { CMETModule } from '../modules/CMETModule';
import pool from '../db/db';
import { operators } from './areas';
import { Stop } from '../types/interfaces';

const router = Router();

const [CMET, CP, MTS, ML, FERTAGUS] = operators.map((a) => a.id);

const cmetModule = new CMETModule();

// Postgres pool and configuration
//const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const STOPS_VIEW = process.env.STOPS_VIEW || 'all_stops';
const STOP_LOC_COL = process.env.STOP_LOC_COL || 'stop_loc';

const DEFAULT_LIMIT = 18;

/**
 * GET /bbox
 * Query params: bbox=minx,miny,maxx,maxy  OR minx,miny,maxx,maxy individually
 * Optional: limit
 * Returns stations within the bounding box using PostGIS ST_Intersects on the configured view/geom column.
 */

router.get('/all', async (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', '*');
    
    try {
        const SQL = `SELECT
                            feed_id,
                            array_agg(DISTINCT stop_name ORDER BY stop_name) AS names,                  
                            array_agg(DISTINCT stop_id) AS ids,
                            ST_X(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lon,
                            ST_Y(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lat
                        FROM ${STOPS_VIEW}
                        GROUP BY feed_id, stop_loc
                        ORDER BY min(stop_name);`;

        const result = await pool.query(SQL);

        const found_stops = result.rows.map((row: any) => ({
            name: (row.names || []).join(' / '),
            ids: (row.ids || []).map((id: any) => String(id)),
            lon: row.lon !== null ? Number(row.lon) : undefined,
            lat: row.lat !== null ? Number(row.lat) : undefined,
            operator: row.feed_id,
        }));

        const resp: StopSearchResult = {
            status: 'OK -- ALL STOPS FROM POSTGRES',
            stop_name_query: 'all',
            area: 'all',
            found_stops,
        };

        res.json(resp);
    } catch (err) {
        console.error('Error querying Postgres for all stations:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', error: String(err) });
    }
});
router.get('/bbox', async (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', '*');

    const limit = !isNaN(Number(req.query.limit)) ? Number(req.query.limit) : DEFAULT_LIMIT;

    // Accept either a single bbox param or four individual params
    let bboxParam = (req.query.bbox as string | undefined) ?? undefined;
    let minx: number | undefined, miny: number | undefined, maxx: number | undefined, maxy: number | undefined;

    if (bboxParam) {
        const parts = bboxParam.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) {
            res.status(400).send('bbox must be four comma-separated numbers: minx,miny,maxx,maxy');
            return;
        }
        [minx, miny, maxx, maxy] = parts;
    } else {
        minx = parseFloat(String(req.query.minx ?? ''));
        miny = parseFloat(String(req.query.miny ?? ''));
        maxx = parseFloat(String(req.query.maxx ?? ''));
        maxy = parseFloat(String(req.query.maxy ?? ''));

        if ([minx, miny, maxx, maxy].some((v) => Number.isNaN(v))) {
            res.status(400).send('Provide bbox param or minx,miny,maxx,maxy query parameters');
            return;
        }
    }

    // Optional feeds filter: comma-separated feed ids (operators)
    //const feedsParam = (req.query.feeds as string | undefined) ?? (req.query.operators as string | undefined);

    try {
        // Build parameterized query dynamically to include optional feeds array
        const params: any[] = [minx, miny, maxx, maxy];

        // if (feedsParam && feedsParam.length > 0) {
        //     const feeds = feedsParam.split(',').map((s) => s.trim());
        //     params.push(feeds);
        //     where += ` AND feed_id = ANY($${params.length})`;
        // }

        // limit is last param
        // params.push(limit);
        // const limitIndex = params.length;

        const SQL = `SELECT
                         feed_id,
                         array_agg(DISTINCT stop_name ORDER BY stop_name) AS names,
                         array_agg(DISTINCT stop_id) AS ids,
                         ST_X(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lon,
                         ST_Y(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lat
                     FROM ${STOPS_VIEW}
                     WHERE ST_Intersects(${STOP_LOC_COL}, ST_MakeEnvelope($1, $2, $3, $4, 4326))
                     GROUP BY feed_id, stop_loc
                     ORDER BY min(stop_name);`;

        console.log('Executing bbox query with params:', { minx, miny, maxx, maxy });
        const result = await pool.query(SQL, [minx, miny, maxx, maxy]);
        console.log('executed query: ')

        const found_stops = result.rows.map((row: any) => ({
            name: (row.names || []).join(' / '),
            ids: (row.ids || []).map((id: any) => String(id)),
            lon: row.lon !== null ? Number(row.lon) : undefined,
            lat: row.lat !== null ? Number(row.lat) : undefined,
            operator: row.feed_id,
        }));

        const resp: StopSearchResult = {
            status: 'OK -- RESULT FROM POSTGRES BBOX',
            stop_name_query: `${minx},${miny},${maxx},${maxy}`,
            area: 'all',
            found_stops,
        };

        res.json(resp);
    } catch (err) {
        console.error('Error querying Postgres for bbox stations:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', error: String(err) });
    }
});



/**
 * GET /:operator/:stop_ids/
 * Return station info. Name, location, and lines for the given stop_ids. 
 */
router.get('/:operator/:stop_ids', async (req: Request, res: Response) => {

    const { operator, stop_ids } = req.params;
    const stopIdsArray = stop_ids.split(',').map((id) => id.trim());

    const s : Stop = {
        name: '',
        ids: stopIdsArray,
        operator: operator,
        lines: []
    }
    
    const lines = await getLinesForStop(s);
    s.lines = lines;

    res.json(s);
})



/**
 * GET /search
 * Query params: name (required), limit (optional)
 * Uses pg_trgm similarity operator (%) if available; falls back to ILIKE.
 */
router.get('/search', async (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', '*');

    const name = (req.query.name ?? req.query.stop_name) as string | undefined;
    const limit = !isNaN(Number(req.query.limit)) ? Number(req.query.limit) : DEFAULT_LIMIT;

    if (!name || typeof name !== 'string') {
        res.status(400).send('name is required');
        return;
    }

    // Optional feeds filter
    const feedsParam2 = (req.query.feeds as string | undefined) ?? (req.query.operators as string | undefined);

    try {
        // Build dynamic params for similarity search + optional feed filter
        const params: any[] = [name];
        let feedWhere = '';
        if (feedsParam2 && feedsParam2.length > 0) {
            const feeds = feedsParam2.split(',').map((s) => s.trim());
            params.push(feeds);
            feedWhere = ` AND feed_id = ANY($${params.length})`;
        }
        // limit param
        params.push(limit);
        const limitIndex = params.length;

        const pgTrgmSQL = `SELECT
                               feed_id,
                               array_agg(DISTINCT stop_name ORDER BY stop_name) AS names,
                               array_agg(DISTINCT stop_id) AS ids,
                               ST_X(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lon,
                               ST_Y(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lat
                           FROM ${STOPS_VIEW}
                           WHERE stop_name_clean % $1 ${feedWhere}
                           GROUP BY feed_id, stop_loc
                           ORDER BY similarity(array_to_string(array_agg(DISTINCT stop_name_clean), ' '), $1) DESC
                           LIMIT $${limitIndex}`;

        let result;
        try {
            result = await pool.query(pgTrgmSQL, params);
        } catch (trgmErr) {
            console.warn('pg_trgm search failed, falling back to ILIKE:', trgmErr);
            // fallback with ILIKE
            const paramsIlike: any[] = [`%${name}%`];
            let feedWhereIlike = '';
            if (feedsParam2 && feedsParam2.length > 0) {
                const feeds = feedsParam2.split(',').map((s) => s.trim());
                paramsIlike.push(feeds);
                feedWhereIlike = ` AND feed_id = ANY($${paramsIlike.length})`;
            }
            paramsIlike.push(limit);
            const ilikeSQL = `SELECT
                                  feed_id,
                                  array_agg(DISTINCT stop_name ORDER BY stop_name) AS names,
                                  array_agg(DISTINCT stop_id) AS ids,
                                  ST_X(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lon,
                                  ST_Y(ST_Transform(${STOP_LOC_COL}::geometry, 4326)) AS lat
                              FROM ${STOPS_VIEW}
                              WHERE stop_name_clean ILIKE $1 ${feedWhereIlike}
                              GROUP BY feed_id, stop_loc
                              LIMIT $${paramsIlike.length};`;
            result = await pool.query(ilikeSQL, paramsIlike);
        }

        let found_stops = result.rows.map((row: any) => ({
            name: (row.names || []).join(' / '),
            ids: (row.ids || []).map((id: any) => String(id)),
            lon: row.lon !== null ? Number(row.lon) : undefined,
            lat: row.lat !== null ? Number(row.lat) : undefined,
            operator: row.feed_id,
            lines: [] as string[]
        }));

        //await untill all lines are fetched before sending response

        await Promise.all(found_stops.map(async (stop) => {
            stop.lines = await getLinesForStop(stop);
        }));

        const resp: StopSearchResult = {
            status: 'OK -- RESULT FROM POSTGRES SEARCH',
            stop_name_query: name,
            area: 'all',
            found_stops,
        };

        res.json(resp);
    } catch (err) {
        console.error('Error querying Postgres for station search:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', error: String(err) });
    }
});






async function getLinesForStop(stop: Stop): Promise<string[]> {
    let lines : string[] = [];
    const orstopid ="or st.stop_id = " 
    let mutltiID = "";

    if(stop.ids.length > 1){
        for (let i = 1; i < stop.ids.length; i++) {
            mutltiID += orstopid + "$" + (i+1) + " ";
        }
    }


    const SQL = `
     select distinct r.route_short_name from ${stop.operator}.routes r
    inner join ${stop.operator}.trips t on t.route_id  = r.route_id 
    inner join ${stop.operator}.stop_times st on t.trip_id = st.trip_id
    where st.stop_id =$1 ${mutltiID}`;

    console.log(SQL)
    console.log("Executing getLinesForStop query with params:", stop.ids);

    // Catching errors from the database query and logging them for debugging purposes.
    let result
    try {
        result = await pool.query(SQL, stop.ids); 
    } catch (error) {
        console.error('Error querying database for lines:', error);
        return []; // Return an empty array if there's an error 
    }

    console.log("getLinesForStop result:", result.rows);

    for (const row of result.rows) {
        switch (stop.operator) { 
            case CP:
                if(row.route_short_name.startsWith("Linha d")){
                    if(!lines.includes("U"))
                       lines.push("U");
                }
                else
                    lines.push(row.route_short_name);
            break;
            case FERTAGUS:
                if(!lines.includes("U"))
                    lines.push("U");
            break;
    
            default:
                lines.push(row.route_short_name);
                break;
        }
    }


    return lines;

}

// Keep exports for existing modules so other routes (departures) can use them
export { cmetModule};
export default router;
