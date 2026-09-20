import type { NextFunction, Request, Response } from 'express';
import { createReadStream, statSync } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { remotes } from './remotes.config';

type ServeMode = 'dev' | 'static';

const remoteByName = new Map(remotes.map((remote) => [remote.name, remote]));

export function createRemotesMiddleware() {
  return async (request: Request, response: Response, next: NextFunction) => {
    const remoteName = request.params.name;
    const remote = remoteByName.get(remoteName);

    if (!remote) {
      response.status(404).json({ message: `Unknown remote "${remoteName}"` });
      return;
    }

    try {
      if (getServeMode() === 'static') {
        await serveStaticRemote(remote.staticPath, request, response);
        return;
      }

      await proxyDevRemote(remote.name, remote.devServer, request, response);
    } catch (error) {
      next(error);
    }
  };
}

function getServeMode(): ServeMode {
  const configuredMode = process.env.REMOTES_SERVE_MODE;

  if (configuredMode === 'dev' || configuredMode === 'static') {
    return configuredMode;
  }

  return process.env.NODE_ENV === 'production' ? 'static' : 'dev';
}

async function serveStaticRemote(
  staticPath: string,
  request: Request,
  response: Response,
) {
  const root = resolve(process.cwd(), staticPath);
  const filePath = resolveStaticFile(root, request.path);

  if (!filePath) {
    response.status(400).json({ message: 'Invalid remote asset path' });
    return;
  }

  try {
    await access(filePath);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.status(404).json({ message: 'Remote asset not found' });
      return;
    }

    response.setHeader('Content-Type', getContentType(filePath));
    createReadStream(filePath).pipe(response);
  } catch {
    response.status(404).json({ message: 'Remote asset not found' });
  }
}

function resolveStaticFile(root: string, requestPath: string) {
  const pathname = decodeURIComponent(requestPath.split('?')[0] ?? '/');
  const relativePath = normalize(pathname.replace(/^\/+/, '') || 'index.html');

  if (
    relativePath.startsWith(`..${sep}`) ||
    relativePath === '..' ||
    isAbsolute(relativePath)
  ) {
    return null;
  }

  const candidate = join(root, relativePath);

  if (!candidate.startsWith(`${root}${sep}`) && candidate !== root) {
    return null;
  }

  if (isDirectory(candidate)) {
    return join(candidate, 'index.html');
  }

  return candidate;
}

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

async function proxyDevRemote(
  remoteName: string,
  devServer: string,
  request: Request,
  response: Response,
) {
  const targetUrl = new URL(request.originalUrl, devServer);
  targetUrl.pathname = request.path;

  const proxyResponse = await fetch(targetUrl, {
    method: request.method,
    headers: getProxyRequestHeaders(request),
    body: hasRequestBody(request.method) ? request : undefined,
    duplex: 'half',
  } as RequestInit & { duplex?: 'half' });

  const shouldRewrite = shouldRewriteDevAsset(proxyResponse);

  response.status(proxyResponse.status);
  proxyResponse.headers.forEach((value, key) => {
    if (!shouldSkipResponseHeader(key, shouldRewrite)) {
      response.setHeader(key, value);
    }
  });

  if (!proxyResponse.body) {
    response.end();
    return;
  }

  if (shouldRewrite) {
    const source = await proxyResponse.text();
    response.setHeader('Content-Type', getProxyContentType(proxyResponse));
    response.setHeader('Cache-Control', 'no-store');
    response.send(rewriteViteDevAsset(remoteName, source));
    return;
  }

  Readable.fromWeb(proxyResponse.body as Parameters<typeof Readable.fromWeb>[0]).pipe(
    response,
  );
}

function shouldRewriteDevAsset(response: globalThis.Response) {
  const contentType = response.headers.get('content-type') ?? '';

  return (
    response.ok &&
    (contentType.includes('text/javascript') ||
      contentType.includes('application/javascript'))
  );
}

function getProxyContentType(response: globalThis.Response) {
  return response.headers.get('content-type') ?? 'text/javascript; charset=utf-8';
}

function rewriteViteDevAsset(remoteName: string, source: string) {
  const publicProxyPrefix = (
    process.env.REMOTES_PUBLIC_PROXY_PREFIX ?? '/proxy/remotes'
  ).replace(/\/+$/, '');
  const remotePrefix = `${publicProxyPrefix}/${remoteName}`;

  return source
    .replaceAll('"/@vite/', `"${remotePrefix}/@vite/`)
    .replaceAll("'\/@vite/", `'${remotePrefix}/@vite/`)
    .replaceAll('"/@id/', `"${remotePrefix}/@id/`)
    .replaceAll("'\/@id/", `'${remotePrefix}/@id/`)
    .replaceAll('"/@fs/', `"${remotePrefix}/@fs/`)
    .replaceAll("'\/@fs/", `'${remotePrefix}/@fs/`)
    .replaceAll('"/@react-refresh', `"${remotePrefix}/@react-refresh`)
    .replaceAll("'\/@react-refresh", `'${remotePrefix}/@react-refresh`)
    .replaceAll('"/src/', `"${remotePrefix}/src/`)
    .replaceAll("'\/src/", `'${remotePrefix}/src/`)
    .replaceAll('"/node_modules/.vite/', `"${remotePrefix}/node_modules/.vite/`)
    .replaceAll("'\/node_modules/.vite/", `'${remotePrefix}/node_modules/.vite/`);
}

function hasRequestBody(method: string) {
  return method !== 'GET' && method !== 'HEAD';
}

function getProxyRequestHeaders(request: Request) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (shouldSkipRequestHeader(key) || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function shouldSkipRequestHeader(header: string) {
  return ['connection', 'content-length', 'host', 'if-none-match', 'if-modified-since'].includes(
    header.toLowerCase(),
  );
}

function shouldSkipResponseHeader(header: string, rewritten = false) {
  const normalizedHeader = header.toLowerCase();

  return (
    ['connection', 'content-length', 'transfer-encoding'].includes(
      normalizedHeader,
    ) ||
    (rewritten &&
      ['cache-control', 'content-encoding', 'etag', 'last-modified'].includes(
        normalizedHeader,
      ))
  );
}

function getContentType(filePath: string) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}
