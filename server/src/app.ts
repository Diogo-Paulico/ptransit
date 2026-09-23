import express from 'express';
import compression from 'compression';
import path from 'path';

import areasRouter from './routes/areas';
import timeRouter from './routes/time';
import stopsRouter from './routes/stops';
import departuresRouter from './routes/departures';
import departuresRouter2 from './routes/departures2';

const app = express();

app.use(compression());
app.use(express.static(path.resolve(__dirname, '/app/frontend')));
app.set('trust proxy', true);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/operators', areasRouter);
app.use('/time', timeRouter);
app.use('/stops', stopsRouter);
app.use('/api/stations', departuresRouter2); // Mount departures for /stops/:operator/:stopid
app.use('/departures', departuresRouter);

app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '/app/frontend', 'index.html'));
});

export default app;
