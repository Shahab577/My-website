'use strict';

/* ==========================================================================
   RapidPestHelp — production server
   --------------------------------------------------------------------------
   Serves the landing page AND the lead API from ONE origin, so the same
   build works on any host and on the final custom domain without URL
   rewriting (the browser calls the relative path /api/lead).

     node server.js          (or: npm start)

   On Vercel you can instead use the serverless function api/lead.js — both
   share lib/lead-handler.js, so behaviour is identical.

   Only the public files are exposed (index.html, thank-you.html, css, js,
   assets). Source, .env and node_modules are never served.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const express = require('express');

/* Load .env for local development only; on a real host the environment
   variables come from the platform (Vercel/Render/Railway dashboard). */
(function loadLocalEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const { handleLead } = require('./lib/lead-handler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.set('trust proxy', true);

/* --- Lead API ----------------------------------------------------------- */
app.use('/api/lead', express.json({ limit: '20kb' }));
app.options('/api/lead', (req, res) => handleLead(req, res));
app.post('/api/lead', (req, res) => handleLead(req, res));
app.all('/api/lead', (req, res) => {
  res.status(405).json({ ok: false, error: 'Method not allowed.' });
});

/* --- Public static files ------------------------------------------------ */
const sendFile = (name) => (req, res) => res.sendFile(path.join(__dirname, name));

app.get('/', sendFile('index.html'));
app.get('/index.html', sendFile('index.html'));
app.get('/thank-you.html', sendFile('thank-you.html'));

app.use('/css', express.static(path.join(__dirname, 'css'), { dotfiles: 'ignore' }));
app.use('/js', express.static(path.join(__dirname, 'js'), { dotfiles: 'ignore' }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'ignore' }));

/* --- Errors ------------------------------------------------------------- */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'Payload too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body.' });
  }
  console.error('[server]', err && err.message);
  return res.status(500).json({ ok: false, error: 'Internal server error.' });
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] lead recipient: ${process.env.LEAD_TO_EMAIL || 'syedshahab9721@gmail.com'}`);
  console.log(`[server] SMTP: ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}`);
});
