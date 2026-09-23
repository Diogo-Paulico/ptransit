import Pool from 'pg';

const pool = new Pool.Pool({
    connectionString: process.env.POSTGRES_URL,
});

export default pool;