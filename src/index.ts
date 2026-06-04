#!/usr/bin/env node
import { loadConfig, printHelp, printVersion } from './config.js';
import { createHttpServer } from './transport/http.js';
import { createStdioServer } from './transport/stdio.js';

import { CalendarService } from './services/calendar-service.js';
import { TasksService } from './services/tasks-service.js';
import { createHandlers } from './tools/handlers.js';
import { setCalendarService, setTasksService, setAuthState } from './tools/definitions.js';
import { OAuth2Client } from 'google-auth-library';
import {
  loadTokens,
  saveTokens,
  getOrCreateKey,
  decryptToken,
  encryptToken,
} from './auth/token-store.js';
import { getAuthUrl, handleCallback, onTokenRefresh } from './auth/oauth-client.js';
import { startCallbackServer } from './auth/callback-server.js';

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
    const key = getOrCreateKey(config.encryptionKey);

    const oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      `http://localhost:${config.oauthPort}/oauth2callback`
    );

    const encrypted = loadTokens();
    if (encrypted) {
      try {
        const tokenJson = decryptToken(encrypted, key);
        const tokens = JSON.parse(tokenJson);
        oauth2Client.setCredentials(tokens);
        console.log('Loaded saved tokens from storage');
      } catch (err) {
        console.error('Failed to load saved tokens:', err instanceof Error ? err.message : err);
      }
    } else {
      console.log('No saved tokens found. Use the authenticate tool to sign in.');
    }

    onTokenRefresh(oauth2Client, (tokens) => {
      const tokenJson = JSON.stringify(tokens);
      const newEncrypted = encryptToken(tokenJson, key);
      saveTokens(newEncrypted);
      console.log('Token refreshed and saved');
    });

    let callbackServer: ReturnType<typeof startCallbackServer> | undefined;
    let authUrl: string | undefined;

    function startAuthFlow() {
      authUrl = getAuthUrl(oauth2Client);
      if (!callbackServer) {
        callbackServer = startCallbackServer(config.oauthPort);
        callbackServer.waitForCode.then(async (code) => {
          try {
            await handleCallback(oauth2Client, code);
            const credentials = oauth2Client.credentials;
            const tokenJson = JSON.stringify(credentials);
            const encrypted = encryptToken(tokenJson, key);
            saveTokens(encrypted);
            console.log('Authentication successful. Tokens saved.');
            callbackServer?.close();
            callbackServer = undefined;
          } catch (err) {
            console.error('Authentication callback failed:', err instanceof Error ? err.message : err);
          }
        }).catch((err) => {
          console.error('Auth flow error:', err instanceof Error ? err.message : err);
        });
      }
      return authUrl;
    }

    const authState = {
      isAuthenticated: () => !!oauth2Client.credentials.access_token,
      startAuthFlow,
    };

    const calendarService = new CalendarService(oauth2Client);
    const tasksService = new TasksService(oauth2Client);
    const handlers = createHandlers(calendarService, tasksService, authState);
    setCalendarService(calendarService);
    setTasksService(tasksService);
    setAuthState(authState);

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
      callbackServer?.close();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down...');
      callbackServer?.close();
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
