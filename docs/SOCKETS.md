# Adding WebSockets / Socket.IO

The base scaffold is REST-only on purpose. When you need real-time
features (chat, dashboards, push notifications, pairing flows), here are
the **four** changes you'll need, in the order they cause production
outages if you skip them.

This file exists because all four have already burned us once. Read it
before adding `python-socketio` or any WebSocket library. It will save
you a debug session.

## TL;DR checklist

- [ ] `python-socketio` mounted on FastAPI ASGI app at `/socket.io/`
- [ ] `cors_allowed_origins=settings.CORS_ORIGINS` on `AsyncServer`
- [ ] `security_middleware` skips `/socket.io/*` (no API-key check on WS)
- [ ] `nginx.conf` has a `location /socket.io/` block with `Upgrade`/`Connection` headers
- [ ] **Public hostname** is in `CORS_ORIGINS` *and* `TRUSTED_HOSTS`
- [ ] Client `path` ends in `/` (`'/socket.io/'`, not `'/socket.io'`)
- [ ] Client uses **default** transport order (don't force `['websocket']` first)

## 1. Backend mount

```python
# backend/socket_io/server.py
import socketio
from config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    # MUST include every public origin the browser loads from. Missing
    # entries cause the WebSocket handshake to be rejected with 403.
    # Origins are full: scheme + host (+ port), no trailing slash.
    cors_allowed_origins=settings.CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)

# backend/main.py
import socketio
from app_factory import create_app
from socket_io.server import sio

app = create_app()
asgi = socketio.ASGIApp(sio, other_asgi_app=app)
# uvicorn entry point should serve `asgi`, not `app`.
```

## 2. Security middleware bypass

`security_middleware` enforces an API key for non-browser callers. It
must not gate `/socket.io/*` — engine.io's polling and websocket frames
don't carry an `X-API-Key` header and CORS handshake validation already
happens at the socket.io server level.

```python
# backend/security.py - inside the middleware
if (
    request.url.path in public_paths
    or request.url.path.startswith(docs_prefix)
    or request.url.path.startswith("/socket.io/")  # <-- REQUIRED
):
    return await call_next(request)
```

## 3. Nginx WS upgrade

The frontend nginx container proxies `/api/` to the backend. Socket.IO
needs its own `location` block with the HTTP/1.1 `Upgrade` headers —
without these, nginx returns the SPA `index.html` for engine.io polling
URLs and the connection silently fails.

Add to `frontend/nginx.conf`:

```nginx
# Socket.IO - WebSocket upgrade required
location /socket.io/ {
    proxy_pass http://backend:8060;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Long-lived connections; don't time them out.
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

## 4. Frontend client

```ts
// src/lib/socket.ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // MUST end in '/' to match nginx `location /socket.io/` and the
      // python-socketio default mount. Without the trailing slash,
      // nginx falls through to the SPA route and returns HTML for
      // polling requests; the client can't parse it and connection
      // failures cascade into a reconnect loop.
      path: '/socket.io/',

      // Do NOT force `transports: ['websocket']`. A bare WS open with
      // no engine.io session id is fragile through CDNs (Cloudflare in
      // particular). The default order is ['polling', 'websocket']:
      // open a polling session over plain HTTP, get a sid, then upgrade
      // to WS. That's the proven pattern through any CDN.
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    })
  }
  return socket
}
```

## 5. Public deployment: env vars

Once the app runs behind a public hostname (Cloudflare, NPM, Caddy,
whatever), the public origin **must** appear in two env vars:

```env
# config/.env on the deploy host
CORS_ORIGINS=http://localhost:3021,http://localhost:8082,https://your-app.example.com
TRUSTED_HOSTS=localhost,127.0.0.1,your-app.example.com
```

Note the asymmetry:
- `CORS_ORIGINS` takes **full origins** (scheme + host, no trailing slash).
- `TRUSTED_HOSTS` takes **bare hostnames** (no scheme, no port, no path).

`make doctor` validates this shape — run it before deploying.

## Diagnosing WebSocket problems

**Symptom**: UI hangs in initial loading state. Backend logs show
`WebSocket /socket.io/... [accepted]` followed immediately by
`connection closed`, with no event handlers firing in between.

**Diagnosis order** (each step takes ~1 minute):

1. **Polling handshake works?**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     "https://your-host/socket.io/?EIO=4&transport=polling" \
     -H "Origin: https://your-host"
   ```
   Expect `200`. If `403` → CORS_ORIGINS missing this origin. If `400` →
   TRUSTED_HOSTS missing this host. If `404` → nginx proxy block missing
   or wrong path.

2. **WebSocket upgrade works?**
   ```bash
   curl -s --http1.1 -o /dev/null -w "%{http_code}\n" --max-time 3 \
     -H "Origin: https://your-host" \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     -H "Sec-WebSocket-Version: 13" \
     "https://your-host/socket.io/?EIO=4&transport=websocket"
   ```
   Expect `101 Switching Protocols`. If `404` → nginx WS block missing
   `Upgrade`/`Connection` headers or `proxy_http_version 1.1`. If you
   get `200` and an HTML body → nginx routed to the SPA fallback
   (likely path mismatch).

3. **Real client gets acks?** Run a non-browser client to isolate
   server-vs-client bugs:
   ```python
   import asyncio, socketio
   async def main():
       sio = socketio.AsyncClient(reconnection=False)
       await sio.connect(
           'https://your-host',
           socketio_path='/socket.io/',
           transports=['websocket'],
           wait_timeout=10,
           headers={'Origin': 'https://your-host'},
       )
       print(await sio.call('your:event', {...}, timeout=5))
       await sio.disconnect()
   asyncio.run(main())
   ```
   Wrap with `timeout 15` so it can't hang forever. If this prints an
   ack, your wire and backend are correct; the bug is in the browser
   client (probably stale service worker or wrong client config).

4. **Stale service worker?** Use **Check for updates**, then **Update now**.
   The new worker waits for acceptance, so the old client remains internally
   consistent while you diagnose it. This scaffold's `swMetadataPlugin`
   stamps a build version into `/sw.js` on every build. See `docs/PWA.md` for
   the multi-tab and Safari inspection checks.

## Why `make doctor` won't catch all of this

`make doctor` validates **config shape**, not **runtime correctness**.
The script can't know whether your nginx has the WS upgrade block or
whether `python-socketio`'s CORS list matches your deployment. Use
this doc + the diagnosis steps when running into actual connection
problems.
