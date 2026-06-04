import { Router } from 'express';

export interface WebhookChannelStore {
  getChannelToken(channelId: string): string | undefined;
}

export const channelStore: {
  tokens: Map<string, string>;
  getChannelToken(channelId: string): string | undefined;
} = {
  tokens: new Map<string, string>(),
  getChannelToken(channelId: string): string | undefined {
    return this.tokens.get(channelId);
  },
};

export function createWebhookEndpoint(channelStore: WebhookChannelStore): Router {
  const router = Router();

  router.post('/google-calendar', (req, res) => {
    const channelId = req.headers['x-goog-channel-id'] as string | undefined;
    const channelToken = req.headers['x-goog-channel-token'] as string | undefined;
    const resourceState = req.headers['x-goog-resource-state'] as string | undefined;
    const resourceId = req.headers['x-goog-resource-id'] as string | undefined;
    const messageNumber = req.headers['x-goog-message-number'] as string | undefined;

    if (!channelId || !channelToken) {
      return res.status(400).send('Missing required headers');
    }

    const storedToken = channelStore.getChannelToken(channelId);
    if (!storedToken || storedToken !== channelToken) {
      return res.status(403).send('Invalid channel token');
    }

    if (resourceState === 'sync') {
      return res.status(200).send('Sync acknowledged');
    }

    console.log(
      `[Webhook] Calendar change notification: channel=${channelId}, resource=${resourceId}, state=${resourceState}, message=${messageNumber}`
    );

    res.status(200).send('OK');
  });

  return router;
}
