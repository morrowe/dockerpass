import http from 'http';
import fs from 'fs/promises';

import { transferData } from './transfer.js';
import { getIdRangeCached, getRequestByIdCached, invalidateRangeCache } from './db.js';

const PORT = 3000;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/') {
        try {
            const html = await fs.readFile('./dist/index.html', 'utf-8');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (error) {
            console.error(error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }

        return;
    }

    if (req.method === 'GET' && url.pathname === '/guess') {
        try {
            const html = await fs.readFile('./public/guess.html', 'utf-8');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (error) {
            console.error(error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }

        return;
    }

    if (req.method === 'GET' && url.pathname === '/style.css') {
        try {
            const css = await fs.readFile('./public/style.css', 'utf-8');

            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(css);
        } catch (error) {
            console.error(error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }

        return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        try {
            const assetName = url.pathname.slice('/assets/'.length).replaceAll('..', '');
            const asset = await fs.readFile(`./dist/assets/${assetName}`);
            const contentType = assetName.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(asset);
        } catch (error) {
            res.writeHead(404);
            res.end('Not Found');
        }

        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/guess/range') {
        try {
            const { data, cache } = await getIdRangeCached();

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': cache });
            res.end(JSON.stringify(data));
        } catch (error) {
            console.error(error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ message: 'Ошибка чтения диапазона' }));
        }

        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/guess/item') {
        const id = Number(url.searchParams.get('id'));

        if (!Number.isFinite(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ message: 'Некорректный id' }));
            return;
        }

        try {
            const { data: item, cache } = await getRequestByIdCached(id);

            if (!item) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ message: 'Запись не найдена' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': cache });
            res.end(JSON.stringify(item));
        } catch (error) {
            console.error(error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ message: 'Ошибка чтения записи' }));
        }

        return;
    }

    if (req.method === 'GET' && url.pathname === '/requests') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: 'Используйте POST /requests для отправки заявки' }));
        return;
    }

    if (req.method === 'POST' && url.pathname === '/requests') {
        let body = '';

        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const saved = await transferData(data);
                await invalidateRangeCache();

                res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ message: 'Анкета сохранена', id: saved.id }));
            } catch (error) {
                console.error(error);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ message: 'Ошибка сохранения анкеты' }));
            }
        });

        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`APP запущен на порту ${PORT}`);
});
