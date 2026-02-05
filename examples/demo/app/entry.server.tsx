import { PassThrough } from 'node:stream';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import type { EntryContext } from 'react-router';

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get('user-agent');
    const isBotRequest = userAgent && isbot(userAgent);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          // For bots, wait for onAllReady instead
          if (!isBotRequest) {
            const body = new PassThrough();
            responseHeaders.set('Content-Type', 'text/html');
            resolve(
              new Response(createReadableStreamFromReadable(body), {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
          }
        },
        onAllReady() {
          // For bots, send the full rendered content
          if (isBotRequest) {
            const body = new PassThrough();
            responseHeaders.set('Content-Type', 'text/html');
            resolve(
              new Response(createReadableStreamFromReadable(body), {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
          }
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
