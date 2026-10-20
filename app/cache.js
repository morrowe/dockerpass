import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
export const CACHE_TTL = Number(process.env.CACHE_TTL || 60);

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => console.error(`[REDIS] ошибка: ${err.message}`));
client.on('ready', () => console.log(`[REDIS] подключено к ${REDIS_URL}`));

client.connect().catch((err) => console.error(`[REDIS] не удалось подключиться: ${err.message}`));



export async function cacheGet(key) {
    if (!client.isReady) {
        console.log(`[REDIS] GET ${key} -> пропущено (нет соединения)`);
        return null;
    }

    try {
        const raw = await client.get(key);

        if (raw === null) {
            console.log(`[REDIS] GET ${key} -> (nil)  => MISS`);
            return null;
        }

        console.log(`[REDIS] GET ${key} -> ${raw}  => HIT`);
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[REDIS] GET ${key} -> ошибка: ${err.message}`);
        return null;
    }
}

export async function cacheSet(key, value, ttl = CACHE_TTL) {
    if (!client.isReady) return;

    try {
        const reply = await client.set(key, JSON.stringify(value), { EX: ttl });
        console.log(`[REDIS] SET ${key} (EX ${ttl}) -> ${reply}`);
    } catch (err) {
        console.error(`[REDIS] SET ${key} -> ошибка: ${err.message}`);
    }
}

export async function cacheDel(key) {
    if (!client.isReady) return;

    try {
        const removed = await client.del(key);
        console.log(`[REDIS] DEL ${key} -> ${removed}`);
    } catch (err) {
        console.error(`[REDIS] DEL ${key} -> ошибка: ${err.message}`);
    }
}
