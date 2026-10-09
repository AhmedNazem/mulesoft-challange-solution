
const http = require('http');

const PORT = process.env.PORT || 3000;
const SLOW_MS = Number(process.env.SLOW_MS || 10000);
const ROUTE = /^\/backend\/customers\/([^/]+)$/;

const customers = {
  'CUST-10001': {
    id: 'CUST-10001', first_name: 'Ahmed', last_name: 'Nadhim',
    email: 'ahmed.nadhim@example.com', mobile: '+9647701234567', birth_date: '1998-05-14',
    address: { city: 'Baghdad', country: 'Iraq', zip: '10001' },
    state: 'ACTIVE', created: '2026-10-07T07:30:00Z',
  },
  'CUST-10002': {
    id: 'CUST-10002', first_name: 'Sara', last_name: 'Ali',
    email: 'sara.ali@example.com', mobile: '+9647812345678', birth_date: '1995-02-03',
    address: { city: 'Basra', country: 'Iraq', zip: '61001' },
    state: 'ACTIVE', created: '2026-10-07T08:00:00Z',
  },
  'CUST-10003': {
    id: 'CUST-10003', first_name: 'Omar', last_name: 'Hassan',
    email: 'omar.h@example.com', mobile: '+9647709876543', birth_date: '1990-11-30',
    address: { city: 'Erbil', country: 'Iraq', zip: '44001' },
    state: 'INACTIVE', created: '2026-10-07T09:00:00Z',
  },
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const match = req.method === 'GET' && ROUTE.exec(req.url.split('?')[0]);
  if (!match) return sendJson(res, 404, { message: 'route not found' });

  let id;
  try { id = decodeURIComponent(match[1]); } catch { return sendJson(res, 400, { message: 'bad id' }); }

  // Log the id and the correlation header only (never customer data).
  console.log(`[${req.headers['x-correlation-id'] || '-'}] GET customer ${id}`);

  switch (id) {
    case 'CUST-BAD': return sendJson(res, 400, { message: 'bad request' });
    case 'CUST-RATE': return sendJson(res, 429, { message: 'too many requests' });
    case 'CUST-ERR': return sendJson(res, 500, { message: 'internal failure' });
    case 'CUST-SLOW':
      return setTimeout(() => sendJson(res, 200, customers['CUST-10001']), SLOW_MS);
    case 'CUST-GARBAGE':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{this is not json');
    default: {
      const customer = customers[id];
      return customer ? sendJson(res, 200, customer) : sendJson(res, 404, { message: 'customer not found' });
    }
  }
});

server.listen(PORT, () => console.log(`mock backend listening on http://localhost:${PORT}/backend`));
