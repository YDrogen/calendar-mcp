import express from 'express';
import type { Express, Request, Response } from 'express';
import { createServer } from 'node:http';

export interface CallbackServer {
  url: string;
  waitForCode: Promise<string>;
  close: () => void;
}

export function startCallbackServer(port: number): CallbackServer {
  const app: Express = express();
  const server = createServer(app);

  let resolveCode: (code: string) => void;
  let rejectCode: (reason: unknown) => void;

  const waitForCode = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  app.get('/oauth2callback', (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;

    if (code) {
      res.send('<html><body><h1>Authorization complete</h1></body></html>');
      resolveCode(code);
    } else {
      res.status(400).send('<html><body><h1>Authorization failed: no code provided</h1></body></html>');
      rejectCode(new Error('No authorization code provided'));
    }
  });

  server.listen(port);

  return {
    url: `http://localhost:${port}/oauth2callback`,
    waitForCode,
    close: () => {
      server.close();
    },
  };
}
