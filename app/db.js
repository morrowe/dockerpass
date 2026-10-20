import pg from 'pg';
import { cacheGet, cacheSet, cacheDel } from './cache.js';

const { Pool } = pg;
const pool = new Pool({
    host: 'postgres',
    port: 5432,
    database: 'form',
    user: 'postgres',
    password: 'postgres',
});

export async function getIdRange() {
    const { rows } = await pool.query(
        'SELECT MIN(id) AS min_id, MAX(id) AS max_id, COUNT(*) AS total FROM requests',
    );
    return rows[0];
}

export async function getRequestById(id) {
    const { rows } = await pool.query(
        `SELECT r.id, r.person_id, r.last_name, r.first_name, r.middle_name, r.birth_place, r.birth_date, r.gender, r.phone, r.created_at,
                p.passport_series, p.passport_number, p.issue_date, p.division_code,
                p.issued_by
         FROM requests r
         LEFT JOIN passports p ON p.request_id = r.id
         WHERE r.id = $1`,
        [id],
    );
    return rows[0] || null;
}


const RANGE_KEY = 'guess:range';
const itemKey = (id) => `guess:item:${id}`;

export async function getIdRangeCached() {
    const cached = await cacheGet(RANGE_KEY);
    if (cached) return { data: cached, cache: 'HIT' };

    const data = await getIdRange();
    await cacheSet(RANGE_KEY, data);
    return { data, cache: 'MISS' };
}

export async function getRequestByIdCached(id) {
    const cached = await cacheGet(itemKey(id));
    if (cached) return { data: cached, cache: 'HIT' };

    const data = await getRequestById(id);
    if (data) await cacheSet(itemKey(id), data); 
    return { data, cache: 'MISS' };
}


export async function invalidateRangeCache() {
    await cacheDel(RANGE_KEY);
}
