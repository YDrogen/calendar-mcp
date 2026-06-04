#!/usr/bin/env node
import { loadConfig, printHelp, printVersion } from './config.js';
import { createHttpServer } from './transport/http.js';
import { createStdioServer } from './transport/stdio.js';

import { CalendarService } from './services/calendar-service.js';
import { createHandlers } from './tools/handlers.js';
import { setCalendarService } from './tools/definitions.js';
import { OAuth2Client } from 'google-auth-library';

export async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printHelp();
    return;
  }

  if (args.includes('--version')) {
    printVersion();
    return;
  }

  try {
    const config = loadConfig();

    const oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      `http://localhost:${config.oauthPort}/oauth2callback`
    );

    const calendarService = new CalendarService(oauth2Client);
    const handlers = createHandlers(calendarService);
    setCalendarService(calendarService);

    if (config.transport === 'http' || config.transport === 'both') {
      const httpServer = createHttpServer(handlers, config.httpPort, config.allowedHosts);
      await httpServer.start();
      console.log(`HTTP server listening on port ${config.httpPort}`);
    }

    if (config.transport === 'stdio' || config.transport === 'both') {
      const stdioServer = createStdioServer(handlers);
      console.log('Stdio transport initialized');
      await stdioServer.start();
    }

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
