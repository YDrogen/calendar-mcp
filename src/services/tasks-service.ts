import { OAuth2Client } from 'google-auth-library';
import { GaxiosError } from 'gaxios';
import { createTasksClient } from './tasks-client.js';
import { withRetry, isGaxiosError } from './google-client.js';
import { tasks_v1 } from '@googleapis/tasks';

function formatGaxiosError(error: GaxiosError, context: string): never {
  const status = error.status ?? (error.response?.status as number | undefined);
  const message = error.message ?? 'Unknown error';

  switch (status) {
    case 400:
      throw new Error(`Invalid request in ${context}: ${message}`);
    case 401:
      throw new Error(`Authentication failed in ${context}: Please re-authenticate.`);
    case 403:
      throw new Error(
        `Permission denied in ${context}: Insufficient permissions for this operation.`
      );
    case 404:
      throw new Error(`Resource not found in ${context}: The requested item does not exist.`);
    case 409:
      throw new Error(`Conflict in ${context}: ${message}`);
    case 429:
      throw new Error(`Rate limit exceeded in ${context}: Please try again later.`);
    case 500:
    case 502:
    case 503:
      throw new Error(
        `Google Tasks service unavailable in ${context}: Please try again later.`
      );
    default:
      throw new Error(`Tasks API error in ${context}: ${message} (status ${status ?? 'unknown'})`);
  }
}

function wrapWithErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  oauth2Client: OAuth2Client
): Promise<T> {
  return withRetry(fn, oauth2Client).catch((error: unknown) => {
    if (isGaxiosError(error)) {
      formatGaxiosError(error as GaxiosError, context);
    }
    throw error;
  });
}

export class TasksService {
  private oauth2Client: OAuth2Client;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
  }

  private getClient(): tasks_v1.Tasks {
    return createTasksClient(this.oauth2Client);
  }

  async listTaskLists(): Promise<tasks_v1.Schema$TaskList[]> {
    const client = this.getClient();
    const response = await wrapWithErrorHandling(
      () => client.tasklists.list(),
      'listTaskLists',
      this.oauth2Client
    );
    return response.data.items ?? [];
  }

  async getTaskList(listId: string): Promise<tasks_v1.Schema$TaskList> {
    const client = this.getClient();
    const response = await wrapWithErrorHandling(
      () => client.tasklists.get({ tasklist: listId }),
      'getTaskList',
      this.oauth2Client
    );
    return response.data;
  }

  async createTaskList(title: string): Promise<tasks_v1.Schema$TaskList> {
    const client = this.getClient();
    const response = await wrapWithErrorHandling(
      () => client.tasklists.insert({ requestBody: { title } }),
      'createTaskList',
      this.oauth2Client
    );
    return response.data;
  }

  async updateTaskList(listId: string, title: string): Promise<tasks_v1.Schema$TaskList> {
    const client = this.getClient();
    const response = await wrapWithErrorHandling(
      () => client.tasklists.patch({ tasklist: listId, requestBody: { title } }),
      'updateTaskList',
      this.oauth2Client
    );
    return response.data;
  }

  async deleteTaskList(listId: string): Promise<void> {
    const client = this.getClient();
    await wrapWithErrorHandling(
      () => client.tasklists.delete({ tasklist: listId }),
      'deleteTaskList',
      this.oauth2Client
    );
  }

  async listTasks(
    listId: string = '@default',
    showCompleted?: boolean,
    showHidden?: boolean,
    dueMin?: string,
    dueMax?: string
  ): Promise<tasks_v1.Schema$Task[]> {
    const client = this.getClient();
    const params: tasks_v1.Params$Resource$Tasks$List = {
      tasklist: listId,
      showCompleted: showCompleted ?? true,
      showHidden: showHidden ?? false,
    };
    if (dueMin) params.dueMin = dueMin;
    if (dueMax) params.dueMax = dueMax;

    const response = await wrapWithErrorHandling(
      () => client.tasks.list(params),
      'listTasks',
      this.oauth2Client
    );
    return response.data.items ?? [];
  }

  async getTask(listId: string, taskId: string): Promise<tasks_v1.Schema$Task> {
    const client = this.getClient();
    const response = await wrapWithErrorHandling(
      () => client.tasks.get({ tasklist: listId, task: taskId }),
      'getTask',
      this.oauth2Client
    );
    return response.data;
  }

  async createTask(
    listId: string = '@default',
    title: string,
    notes?: string,
    due?: string,
    parent?: string
  ): Promise<tasks_v1.Schema$Task> {
    const client = this.getClient();
    const requestBody: tasks_v1.Schema$Task = { title };
    if (notes) requestBody.notes = notes;
    if (due) requestBody.due = due;
    if (parent) requestBody.parent = parent;

    const response = await wrapWithErrorHandling(
      () => client.tasks.insert({ tasklist: listId, requestBody }),
      'createTask',
      this.oauth2Client
    );
    return response.data;
  }

  async updateTask(
    listId: string,
    taskId: string,
    title?: string,
    notes?: string,
    due?: string,
    status?: 'needsAction' | 'completed'
  ): Promise<tasks_v1.Schema$Task> {
    const client = this.getClient();
    const requestBody: tasks_v1.Schema$Task = {};
    if (title) requestBody.title = title;
    if (notes !== undefined) requestBody.notes = notes;
    if (due !== undefined) requestBody.due = due;
    if (status) requestBody.status = status;

    const response = await wrapWithErrorHandling(
      () => client.tasks.patch({ tasklist: listId, task: taskId, requestBody }),
      'updateTask',
      this.oauth2Client
    );
    return response.data;
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    const client = this.getClient();
    await wrapWithErrorHandling(
      () => client.tasks.delete({ tasklist: listId, task: taskId }),
      'deleteTask',
      this.oauth2Client
    );
  }

  async completeTask(listId: string, taskId: string): Promise<tasks_v1.Schema$Task> {
    return this.updateTask(listId, taskId, undefined, undefined, undefined, 'completed');
  }

  async moveTask(
    listId: string,
    taskId: string,
    parent?: string,
    previous?: string
  ): Promise<tasks_v1.Schema$Task> {
    const client = this.getClient();
    const params: tasks_v1.Params$Resource$Tasks$Move = {
      tasklist: listId,
      task: taskId,
    };
    if (parent) params.parent = parent;
    if (previous) params.previous = previous;

    const response = await wrapWithErrorHandling(
      () => client.tasks.move(params),
      'moveTask',
      this.oauth2Client
    );
    return response.data;
  }
}
