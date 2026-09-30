import { createServer } from 'node:http';
import { createHandler } from './app.js';
import { existsSync } from 'node:fs';
if (process.env.NODE_ENV !== 'production' && existsSync('.env.local'))
  process.loadEnvFile('.env.local');
const origin = process.env.FRONTEND_ORIGIN ?? 'http://127.0.0.1:5173';
const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
if (!/^[a-f0-9]{32}$/.test(clientId))
  throw new Error('Set SPOTIFY_CLIENT_ID to your public Spotify application ID.');
if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))
  throw new Error('FRONTEND_ORIGIN must be the HTTPS frontend origin in production.');
const port = Number(process.env.PORT ?? 3001);
createServer(createHandler({ origin, clientId })).listen(port, '0.0.0.0', () =>
  console.log(`Lunara API listening on port ${port}`),
);
