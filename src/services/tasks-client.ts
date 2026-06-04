import { tasks, tasks_v1 } from '@googleapis/tasks';
import { OAuth2Client } from 'google-auth-library';

export function createTasksClient(oauth2Client: OAuth2Client): tasks_v1.Tasks {
  return tasks({ version: 'v1', auth: oauth2Client });
}
