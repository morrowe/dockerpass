import http from 'http';

const DATABASE_HOST = 'database';
const DATABASE_PORT = 5005;
const DATABASE_PATH = '/form';

export function transferData(data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = http.request({
            hostname: DATABASE_HOST,
            port: DATABASE_PORT,
            path: DATABASE_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, res => {
            let responseBody = '';
            res.on('data', chunk => { responseBody += chunk; });
            res.on('end', () => {
                let result;
                try { result = JSON.parse(responseBody); }
                catch { return reject(new Error(`Некорректный ответ DATABASE: ${responseBody}`)); }
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(result);
                else reject(new Error(result.message || `DATABASE вернул код ${res.statusCode}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
