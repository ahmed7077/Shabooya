// Test-only Supabase protocol adapter. Executes the production migration in real PostgreSQL (PGlite).
// Authentication and object bytes are fixtures; this server is never imported by application code.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create schema storage; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`,
);
for (const file of (await readdir('supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
const users = new Map(),
  objects = new Map();
function session(user) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: user.id,
    user,
  };
}
const tables = new Set([
  'profiles',
  'user_settings',
  'timetables',
  'timetable_entries',
  'sessions',
  'sessions_with_attendance',
  'attendance',
  'calendar_exceptions',
]);
const functions = new Set([
  'activate_timetable',
  'mark_attendance',
  'change_session',
  'add_holiday',
  'delete_personal_data',
]);
let tail = Promise.resolve();
async function serve(req, res) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    process.env.TEST_ORIGIN || 'http://127.0.0.1:3100',
  );
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  );
  res.setHeader('Access-Control-Expose-Headers', 'content-range');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  let body = {};
  if (bytes.length && req.headers['content-type']?.includes('json'))
    body = JSON.parse(bytes.toString());
  const send = (value, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(value, (key, value) =>
        key.endsWith('_date') && typeof value === 'string'
          ? value.slice(0, 10)
          : value,
      ),
    );
  };
  if (url.pathname === '/health') {
    send({ ok: true });
    return;
  }
  if (url.pathname === '/__reset') {
    await db.exec('truncate auth.users cascade; delete from storage.objects;');
    users.clear();
    objects.clear();
    send({ ok: true });
    return;
  }
  let id;
  try {
    id = JSON.parse(
      Buffer.from(
        (req.headers.authorization || '').split('.')[1],
        'base64url',
      ).toString(),
    ).sub;
  } catch {}
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/signup') || url.pathname.endsWith('/token')) {
      let user =
        users.get(body.email) ||
        [...users.values()].find((u) => u.id === body.refresh_token);
      if (!user) {
        user = {
          id: randomUUID(),
          email: body.email || 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: { provider: 'email' },
          user_metadata: {},
        };
        users.set(user.email, user);
        await db.query('insert into auth.users values($1,$2)', [
          user.id,
          user.email,
        ]);
      }
      send(session(user));
      return;
    }
    if (url.pathname.endsWith('/user')) {
      send([...users.values()].find((u) => u.id === id));
      return;
    }
    send({});
    return;
  }
  if (!id) {
    send({ message: 'Unauthorized' }, 401);
    return;
  }
  try {
    await db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').pop();
        if (!functions.has(name)) throw new Error('Unknown function');
        const keys = Object.keys(body);
        if (keys.some((k) => !/^\w+$/.test(k))) throw new Error('Invalid key');
        const result = await tx.query(
          `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')})`,
          Object.values(body),
        );
        send(result.rows[0][name]);
        return;
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const name = url.pathname.split('/').pop();
        if (!tables.has(name)) throw new Error('Invalid table');
        if (req.method === 'GET') {
          const values = [],
            conditions = [];
          for (const [key, value] of url.searchParams) {
            if (['select', 'order', 'offset', 'limit'].includes(key)) continue;
            if (!/^\w+$/.test(key)) throw new Error('Invalid column');
            if (value.startsWith('eq.')) {
              values.push(
                value.slice(3) === 'true'
                  ? true
                  : value.slice(3) === 'false'
                    ? false
                    : value.slice(3),
              );
              conditions.push(`${key}=$${values.length}`);
            }
          }
          const order = url.searchParams.get('order');
          const ordering = order
            ? order
                .split(',')
                .map((x) => {
                  const [column, direction] = x.split('.');
                  if (!/^\w+$/.test(column)) throw new Error('Invalid order');
                  return `${column} ${direction === 'desc' ? 'desc' : 'asc'}`;
                })
                .join(',')
            : '';
          const limit = Math.min(
              1000,
              Number(url.searchParams.get('limit') || 1000),
            ),
            offset = Number(url.searchParams.get('offset') || 0);
          const result = await tx.query(
            `select * from ${name}${conditions.length ? ' where ' + conditions.join(' and ') : ''}${ordering ? ' order by ' + ordering : ''} limit ${limit} offset ${offset}`,
            values,
          );
          const object = req.headers.accept?.includes('vnd.pgrst.object');
          send(object ? result.rows[0] || null : result.rows);
          return;
        }
        if (req.method === 'POST') {
          if (!['profiles', 'user_settings'].includes(name))
            throw new Error('Direct writes prohibited');
          const keys = Object.keys(body);
          if (keys.some((k) => !/^\w+$/.test(k)))
            throw new Error('Invalid key');
          const primary = name === 'profiles' ? 'id' : 'user_id';
          await tx.query(
            `insert into ${name}(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')}) on conflict(${primary}) do update set ${keys
              .filter((k) => k !== primary)
              .map((k) => `${k}=excluded.${k}`)
              .join(',')}`,
            Object.values(body),
          );
          send(null, 201);
          return;
        }
      }
      if (url.pathname.startsWith('/storage/v1/')) {
        if (url.pathname.includes('/object/list/')) {
          const prefix = body.prefix;
          const rows = await tx.query(
            'select name from storage.objects where name like $1 limit 100',
            [`${prefix}/%`],
          );
          send(rows.rows.map((r) => ({ name: r.name.split('/').pop() })));
          return;
        }
        if (req.method === 'DELETE') {
          for (const name of body.prefixes || []) {
            await tx.query('delete from storage.objects where name=$1', [name]);
            objects.delete(name);
          }
          send([]);
          return;
        }
        if (url.pathname.includes('/object/sign/')) {
          send({
            signedURL:
              '/object/timetable-images/' +
              url.pathname.split('/timetable-images/')[1],
          });
          return;
        }
        const name = url.pathname.split('/timetable-images/')[1];
        if (req.method === 'POST') {
          await tx.query(
            "insert into storage.objects(bucket_id,name) values('timetable-images',$1)",
            [name],
          );
          objects.set(name, bytes);
          send({ Key: name });
          return;
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(objects.get(name));
          return;
        }
      }
      send({ message: 'Not found' }, 404);
    });
  } catch (error) {
    send({ message: error.message, code: 'TEST_ERROR' }, 400);
  }
}
createServer((req, res) => {
  tail = tail
    .then(() => serve(req, res))
    .catch((error) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
}).listen(Number(process.env.TEST_PORT || 54329), '127.0.0.1', () =>
  console.log('PostgreSQL-backed test adapter ready.'),
);
