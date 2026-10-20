import http from 'http';
import { migrateSchema, saveToDatabase } from './database.js';
import { seedIfEmpty } from './seed.js';

const PORT = 5005;

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
    }

    if (req.method === 'POST' && req.url === '/form') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const saved = await saveToDatabase(data);
                res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(saved));
            } catch (error) {
                console.error(error);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ message: 'Ошибка сохранения анкеты' }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
});


try {
    await migrateSchema();
    await seedIfEmpty();
} catch (error) {
    console.error('[SEED] ошибка генерации данных', error);
    process.exit(1);
}

server.listen(PORT, () => {
    console.log(`DATABASE запущена на порту ${PORT}`);
});
