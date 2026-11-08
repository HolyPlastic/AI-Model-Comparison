// server.mjs — the local home for the comparison page.
//
// Serves the page and the live numbers on 127.0.0.1, so the browser never needs
// an API key and never hits a cross-origin wall. One process, no dependencies.
//
//   GET /            the page
//   GET /api/live    merged live numbers (cached; ?force=1 re-fetches)
//   GET /api/health  is it up, when did each source last answer
//
// Port is 8099 by default; set PORT to change it.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLive } from './live.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8099)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
}

// One in-flight fetch at a time. Pressing refresh twice must not double the
// calls to a rate-limited source, and two tabs must share the answer.
let inFlight = null
async function live(force) {
  if (inFlight) return inFlight
  inFlight = getLive({ force }).finally(() => {
    inFlight = null
  })
  return inFlight
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const path = decodeURIComponent(url.pathname)

  try {
    if (path === '/api/live') {
      const force = url.searchParams.get('force') === '1'
      const started = Date.now()
      const data = await live(force)
      res.setHeader('x-fetch-ms', String(Date.now() - started))
      return send(res, 200, JSON.stringify(data))
    }

    if (path === '/api/health') {
      const started = Date.now()
      const data = await live(false)
      return send(res, 200, JSON.stringify({
        ok: true,
        port: PORT,
        ms: Date.now() - started,
        generated_at: data.generated_at,
        sources: data.sources,
        counts: data.counts,
      }))
    }

    // static files from the repo root, no traversal
    const rel = path === '/' ? 'ai-model-comparison.html' : path.replace(/^\/+/, '')
    if (rel.includes('..')) return send(res, 400, '{"error":"bad path"}')
    const file = join(HERE, rel)
    const body = await readFile(file)
    return send(res, 200, body, TYPES[extname(file).toLowerCase()] || 'application/octet-stream')
  } catch (e) {
    if (e?.code === 'ENOENT') return send(res, 404, '{"error":"not found"}')
    return send(res, 500, JSON.stringify({ error: String(e?.message ?? e) }))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI Model Comparison  →  http://127.0.0.1:${PORT}`)
})

// A second launch (double-clicked shortcut, or startup plus a manual open) is
// not an error: the first one is already serving.
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Already running on http://127.0.0.1:${PORT}`)
    process.exit(0)
  }
  console.error(e)
  process.exit(1)
})
