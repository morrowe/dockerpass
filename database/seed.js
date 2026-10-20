import pg from 'pg';
import { fakerRU as faker } from '@faker-js/faker';

const { Pool } = pg;

const SEED_COUNT = 1001;

const pool = new Pool({
    host: 'postgres',
    port: 5432,
    database: 'form',
    user: 'postgres',
    password: 'postgres',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoDate = (date) => date.toISOString().slice(0, 10);

function generatePerson() {
    const sex = faker.person.sexType();
    const lastName = faker.person.lastName(sex);
    const firstName = faker.person.firstName(sex);
    const middleName = faker.person.middleName(sex);

    const birthDate = faker.date.birthdate({ min: 18, max: 80, mode: 'age' });
    const issueDate = faker.date.between({
        from: new Date(birthDate.getTime() + 14 * 365 * 24 * 3600 * 1000),
        to: new Date(),
    });

    return {
        lastName,
        firstName,
        middleName,
        birthPlace: faker.location.city(),
        birthDate: isoDate(birthDate),
        gender: sex === 'male' ? 'Мужской' : 'Женский',
        phone: faker.phone.number(),
        passportSeries: faker.string.numeric({ length: 4 }),
        passportNumber: faker.string.numeric({ length: 6 }),
        issueDate: isoDate(issueDate),
        divisionCode: `${faker.string.numeric(3)}-${faker.string.numeric(3)}`,
        issuedBy: `Отделом УФМС России по г. ${faker.location.city()}`,
    };
}

async function waitForTables() {
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            await pool.query('SELECT 1 FROM requests LIMIT 1');
            return;
        } catch (error) {
            console.log(`[SEED] ожидание таблиц... попытка ${attempt}/30 (${error.message})`);
            await sleep(2000);
        }
    }
    throw new Error('Таблицы requests/passports не появились');
}

export async function seedIfEmpty() {
    await waitForTables();

    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM requests');
    if (rows[0].total > 0) {
        console.log(`[SEED] в таблице уже ${rows[0].total} записей — генерация пропущена`);
        return;
    }

    console.log(`[SEED] Faker генерирует ${SEED_COUNT} анкет...`);
    const usedPassports = new Set();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (let id = 1; id <= SEED_COUNT; id++) {
            const p = generatePerson();

            while (usedPassports.has(p.passportSeries + p.passportNumber)) {
                p.passportNumber = faker.string.numeric({ length: 6 });
            }
            usedPassports.add(p.passportSeries + p.passportNumber);

            await client.query(
                `INSERT INTO requests (id, person_id, last_name, first_name, middle_name, birth_place, birth_date, gender, phone)
                 VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, p.lastName, p.firstName, p.middleName, p.birthPlace, p.birthDate, p.gender, p.phone],
            );

            await client.query(
                `INSERT INTO passports
                    (request_id, passport_series, passport_number, birth_date,
                     issue_date, division_code, issued_by, birth_place, gender)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, p.passportSeries, p.passportNumber, p.birthDate,
                 p.issueDate, p.divisionCode, p.issuedBy, p.birthPlace, p.gender],
            );
        }

        await client.query(
            `SELECT setval(pg_get_serial_sequence('requests', 'id'), $1, true)`, [SEED_COUNT]);
        await client.query(
            `SELECT setval(pg_get_serial_sequence('passports', 'id'), $1, true)`, [SEED_COUNT]);

        await client.query('COMMIT');
        console.log(`[SEED] готово: создано ${SEED_COUNT} анкет (ID 1..${SEED_COUNT})`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
