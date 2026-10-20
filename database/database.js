import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'postgres', port: 5432, database: 'form', user: 'postgres', password: 'postgres',
});

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const digits = (value) => (value || '').replace(/\D/g, '');
const dateValue = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
};

export async function migrateSchema() {
    await pool.query('ALTER TABLE requests DROP COLUMN IF EXISTS email');
    await pool.query('ALTER TABLE passports DROP COLUMN IF EXISTS registration');
    await pool.query('ALTER TABLE passports DROP COLUMN IF EXISTS actual_address');
}

export async function saveToDatabase(data) {
    const client = await pool.connect();
    const lastName = clean(data.lastName);
    const firstName = clean(data.firstName);
    const middleName = clean(data.middleName);
    const person = {
        lastName, firstName, middleName,
        birthPlace: clean(data.birthPlace), birthDate: dateValue(data.birthDate), gender: clean(data.gender),
        phone: clean(data.phone),
        passportSeries: clean(data.passportSeries), passportNumber: clean(data.passportNumber),
        issueDate: dateValue(data.issueDate), divisionCode: clean(data.divisionCode),
        issuedBy: clean(data.issuedBy),
    };

    try {
        await client.query('BEGIN');

        const { rows: matches } = await client.query(`
            SELECT r.id, COALESCE(r.person_id, r.id) AS person_id
            FROM requests r LEFT JOIN passports p ON p.request_id = r.id
            WHERE ($1::text IS NOT NULL AND regexp_replace(coalesce(r.phone,''), '[^0-9]', '', 'g') = $1)
               OR ($2::text IS NOT NULL AND p.passport_series = $2 AND p.passport_number = $3)
               OR ($4::text IS NOT NULL AND $5::text IS NOT NULL
                   AND lower(trim(r.last_name)) = $4
                   AND lower(trim(r.first_name)) = $5
                   AND r.birth_date = $6::date)
               OR ($7::text IS NOT NULL AND $8::text IS NOT NULL
                   AND lower(trim(r.first_name)) = $7
                   AND lower(trim(r.middle_name)) = $8
                   AND r.birth_date = $9::date)
            ORDER BY r.id DESC LIMIT 1
        `, [digits(person.phone) || null,
            person.passportSeries, person.passportNumber,
            person.lastName?.toLowerCase() || null, person.firstName?.toLowerCase() || null, person.birthDate,
            person.firstName?.toLowerCase() || null, person.middleName?.toLowerCase() || null, person.birthDate]);

        const requestResult = await client.query(
            `INSERT INTO requests (person_id,last_name,first_name,middle_name,birth_place,birth_date,gender,phone)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id,last_name,first_name,middle_name,birth_place,birth_date,gender,phone,created_at`,
            [matches[0]?.person_id || matches[0]?.id || null, person.lastName, person.firstName,
             person.middleName, person.birthPlace, person.birthDate, person.gender, person.phone],
        );
        const request = requestResult.rows[0];
        const personId = matches[0]?.person_id || request.id;
        await client.query('UPDATE requests SET person_id = $1 WHERE id = $2', [personId, request.id]);

        const passportFields = [person.passportSeries, person.passportNumber, person.issueDate, person.divisionCode, person.issuedBy];
        if (passportFields.some(Boolean)) {
            await client.query(
                `INSERT INTO passports (request_id,passport_series,passport_number,birth_date,issue_date,
                     division_code,issued_by,birth_place,gender)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [request.id, person.passportSeries, person.passportNumber, person.birthDate,
                 person.issueDate, person.divisionCode, person.issuedBy, person.birthPlace, person.gender],
            );
        }

        await client.query('COMMIT');
        return {
            ...request, person_id: personId, existingPerson: matches.length > 0,
            matchedRequestId: matches[0]?.id || null, personId,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
