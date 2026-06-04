import { GaxiosError } from 'gaxios';
import {
  Schema$Event,
  Schema$CalendarListEntry,
  Schema$FreeBusyResponse,
  Schema$Channel,
} from '../types/calendar.js';
import {
  ListEventsInput,
  GetEventInput,
  CreateEventInput,
  UpdateEventInput,
  DeleteEventInput,
  ListEventInstancesInput,
  CreateRecurringEventInput,
  QueryFreeBusyInput,
  GetCalendarInput,
  SubscribeCalendarInput,
  UnsubscribeCalendarInput,
  SearchEventsInput,
  ListTaskListsInput,
  GetTaskListInput,
  CreateTaskListInput,
  UpdateTaskListInput,
  DeleteTaskListInput,
  ListTasksInput,
  GetTaskInput,
  CreateTaskInput,
  UpdateTaskInput,
  DeleteTaskInput,
  CompleteTaskInput,
  MoveTaskInput,
  AuthenticateInput,
} from '../types/tools.js';

export interface CalendarService {
  listEvents(
    calendarId?: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string
  ): Promise<Schema$Event[]>;
  getEvent(calendarId?: string, eventId?: string): Promise<Schema$Event>;
  createEvent(
    calendarId?: string,
    event?: Partial<Schema$Event>
  ): Promise<Schema$Event>;
  updateEvent(
    calendarId?: string,
    eventId?: string,
    event?: Partial<Schema$Event>
  ): Promise<Schema$Event>;
  deleteEvent(calendarId?: string, eventId?: string): Promise<void>;
  listEventInstances(
    calendarId?: string,
    eventId?: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number
  ): Promise<Schema$Event[]>;
  createRecurringEvent(
    calendarId?: string,
    event?: Partial<Schema$Event>
  ): Promise<Schema$Event>;
  queryFreeBusy(
    calendarIds?: string[],
    timeMin?: string,
    timeMax?: string,
    timeZone?: string
  ): Promise<Schema$FreeBusyResponse>;
  listCalendars(): Promise<Schema$CalendarListEntry[]>;
  getCalendar(calendarId?: string): Promise<Schema$CalendarListEntry>;
  subscribeCalendar(
    calendarId?: string,
    webhookUrl?: string
  ): Promise<Schema$Channel>;
  unsubscribeCalendar(channelId?: string): Promise<void>;
  listSubscriptions(): Promise<Schema$Channel[]>;
  getChannelToken(channelId?: string): string | undefined;
  searchEvents(
    calendarId?: string,
    q?: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number
  ): Promise<Schema$Event[]>;
  getCurrentTime(): Promise<{ currentTime: string; timezone: string }>;
}

export interface TasksService {
  listTaskLists(): Promise<{ id?: string | null; title?: string | null }[]>;
  getTaskList(listId: string): Promise<{ id?: string | null; title?: string | null }>;
  createTaskList(title: string): Promise<{ id?: string | null; title?: string | null }>;
  updateTaskList(listId: string, title: string): Promise<{ id?: string | null; title?: string | null }>;
  deleteTaskList(listId: string): Promise<void>;
  listTasks(
    listId?: string,
    showCompleted?: boolean,
    showHidden?: boolean,
    dueMin?: string,
    dueMax?: string
  ): Promise<{ id?: string | null; title?: string | null; status?: string | null }[]>;
  getTask(listId: string, taskId: string): Promise<{ id?: string | null; title?: string | null; status?: string | null }>;
  createTask(
    listId?: string,
    title?: string,
    notes?: string,
    due?: string,
    parent?: string
  ): Promise<{ id?: string | null; title?: string | null; status?: string | null }>;
  updateTask(
    listId: string,
    taskId: string,
    title?: string,
    notes?: string,
    due?: string,
    status?: 'needsAction' | 'completed'
  ): Promise<{ id?: string | null; title?: string | null; status?: string | null }>;
  deleteTask(listId: string, taskId: string): Promise<void>;
  completeTask(listId: string, taskId: string): Promise<{ id?: string | null; title?: string | null; status?: string | null }>;
  moveTask(
    listId: string,
    taskId: string,
    parent?: string,
    previous?: string
  ): Promise<{ id?: string | null; title?: string | null; status?: string | null }>;
}

function formatError(error: unknown): string {
  if (error instanceof GaxiosError) {
    const status = error.response?.status ?? error.status;
    const statusText = status ? ` (${status})` : '';

    const errorData = error.response?.data as
      | {
          error?: {
            errors?: Array<{ reason?: string; message?: string }>;
            message?: string;
          };
        }
      | undefined;
    const reason = errorData?.error?.errors?.[0]?.reason;
    const message =
      errorData?.error?.errors?.[0]?.message ??
      errorData?.error?.message ??
      error.message;

    if (status === 404) {
      return `Calendar API Error (404): Event not found. Reason: ${reason}. Message: ${message}`;
    }

    if (status === 429) {
      return `Calendar API Error (429): Rate limit exceeded. Reason: ${reason}. Message: ${message}. Please try again later.`;
    }

    return `Calendar API Error${statusText}: Reason: ${reason}. Message: ${message}.`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

export interface AuthState {
  isAuthenticated: () => boolean;
  startAuthFlow: () => string;
}

export type ToolCallResult = {
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

async function handleToolCall<T>(fn: () => Promise<T>): Promise<ToolCallResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: formatError(error) }],
    };
  }
}

export function createHandlers(
  calendarService: CalendarService,
  tasksService: TasksService,
  authState?: AuthState
): {
  [name: string]: (input: unknown) => Promise<ToolCallResult>;
} {
  const handlers: Record<string, (input: unknown) => Promise<ToolCallResult>> = {
    list_events: async (input: unknown) => {
      const typedInput = input as ListEventsInput;
      return handleToolCall(() =>
        calendarService.listEvents(
          typedInput.calendarId,
          typedInput.timeMin,
          typedInput.timeMax,
          typedInput.maxResults,
          typedInput.q
        )
      );
    },

    get_event: async (input: unknown) => {
      const typedInput = input as GetEventInput;
      return handleToolCall(() =>
        calendarService.getEvent(typedInput.calendarId, typedInput.eventId)
      );
    },

    create_event: async (input: unknown) => {
      const typedInput = input as CreateEventInput;
      const { calendarId, ...eventBody } = typedInput;
      return handleToolCall(() =>
        calendarService.createEvent(calendarId, eventBody)
      );
    },

    update_event: async (input: unknown) => {
      const typedInput = input as UpdateEventInput;
      const { calendarId, eventId, ...eventBody } = typedInput;
      return handleToolCall(() =>
        calendarService.updateEvent(calendarId, eventId, eventBody)
      );
    },

    delete_event: async (input: unknown) => {
      const typedInput = input as DeleteEventInput;
      return handleToolCall(() =>
        calendarService.deleteEvent(typedInput.calendarId, typedInput.eventId)
      );
    },

    list_event_instances: async (input: unknown) => {
      const typedInput = input as ListEventInstancesInput;
      return handleToolCall(() =>
        calendarService.listEventInstances(
          typedInput.calendarId,
          typedInput.eventId,
          typedInput.timeMin,
          typedInput.timeMax,
          typedInput.maxResults
        )
      );
    },

    create_recurring_event: async (input: unknown) => {
      const typedInput = input as CreateRecurringEventInput;
      const { calendarId, ...eventBody } = typedInput;
      return handleToolCall(() =>
        calendarService.createRecurringEvent(calendarId, eventBody)
      );
    },

    query_free_busy: async (input: unknown) => {
      const typedInput = input as QueryFreeBusyInput;
      return handleToolCall(() =>
        calendarService.queryFreeBusy(
          typedInput.calendarIds,
          typedInput.timeMin,
          typedInput.timeMax,
          typedInput.timeZone
        )
      );
    },

    list_calendars: async (_input: unknown) =>
      handleToolCall(() => calendarService.listCalendars()),

    get_calendar: async (input: unknown) => {
      const typedInput = input as GetCalendarInput;
      return handleToolCall(() => calendarService.getCalendar(typedInput.calendarId));
    },

    subscribe_calendar: async (input: unknown) => {
      const typedInput = input as SubscribeCalendarInput;
      return handleToolCall(() =>
        calendarService.subscribeCalendar(typedInput.calendarId, typedInput.webhookUrl)
      );
    },

    unsubscribe_calendar: async (input: unknown) => {
      const typedInput = input as UnsubscribeCalendarInput;
      return handleToolCall(() =>
        calendarService.unsubscribeCalendar(typedInput.channelId)
      );
    },

    list_subscriptions: async (_input: unknown) =>
      handleToolCall(() => calendarService.listSubscriptions()),

    search_events: async (input: unknown) => {
      const typedInput = input as SearchEventsInput;
      return handleToolCall(() =>
        calendarService.searchEvents(
          typedInput.calendarId,
          typedInput.q,
          typedInput.timeMin,
          typedInput.timeMax,
          typedInput.maxResults
        )
      );
    },

    get_current_time: async (_input: unknown) =>
      handleToolCall(() => calendarService.getCurrentTime()),

    list_task_lists: async (_input: unknown) =>
      handleToolCall(() => tasksService.listTaskLists()),

    get_task_list: async (input: unknown) => {
      const typedInput = input as GetTaskListInput;
      return handleToolCall(() => tasksService.getTaskList(typedInput.listId));
    },

    create_task_list: async (input: unknown) => {
      const typedInput = input as CreateTaskListInput;
      return handleToolCall(() => tasksService.createTaskList(typedInput.title));
    },

    update_task_list: async (input: unknown) => {
      const typedInput = input as UpdateTaskListInput;
      return handleToolCall(() =>
        tasksService.updateTaskList(typedInput.listId, typedInput.title)
      );
    },

    delete_task_list: async (input: unknown) => {
      const typedInput = input as DeleteTaskListInput;
      return handleToolCall(() => tasksService.deleteTaskList(typedInput.listId));
    },

    list_tasks: async (input: unknown) => {
      const typedInput = input as ListTasksInput;
      return handleToolCall(() =>
        tasksService.listTasks(
          typedInput.listId,
          typedInput.showCompleted,
          typedInput.showHidden,
          typedInput.dueMin,
          typedInput.dueMax
        )
      );
    },

    get_task: async (input: unknown) => {
      const typedInput = input as GetTaskInput;
      return handleToolCall(() =>
        tasksService.getTask(typedInput.listId, typedInput.taskId)
      );
    },

    create_task: async (input: unknown) => {
      const typedInput = input as CreateTaskInput;
      return handleToolCall(() =>
        tasksService.createTask(
          typedInput.listId,
          typedInput.title,
          typedInput.notes,
          typedInput.due,
          typedInput.parent
        )
      );
    },

    update_task: async (input: unknown) => {
      const typedInput = input as UpdateTaskInput;
      return handleToolCall(() =>
        tasksService.updateTask(
          typedInput.listId,
          typedInput.taskId,
          typedInput.title,
          typedInput.notes,
          typedInput.due,
          typedInput.status
        )
      );
    },

    delete_task: async (input: unknown) => {
      const typedInput = input as DeleteTaskInput;
      return handleToolCall(() =>
        tasksService.deleteTask(typedInput.listId, typedInput.taskId)
      );
    },

    complete_task: async (input: unknown) => {
      const typedInput = input as CompleteTaskInput;
      return handleToolCall(() =>
        tasksService.completeTask(typedInput.listId, typedInput.taskId)
      );
    },

    move_task: async (input: unknown) => {
      const typedInput = input as MoveTaskInput;
      return handleToolCall(() =>
        tasksService.moveTask(
          typedInput.listId,
          typedInput.taskId,
          typedInput.parent,
          typedInput.previous
        )
      );
    },

    authenticate: async (_input: unknown) => {
      if (!authState) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Auth state not initialized. Check server configuration.' }],
        };
      }
      if (authState.isAuthenticated()) {
        return {
          content: [{ type: 'text', text: 'Already authenticated. Tokens loaded and active.' }],
        };
      }
      const url = authState.startAuthFlow();
      return {
        content: [
          {
            type: 'text',
            text: `Open this URL in your browser to authorize Google access: ${url}\n\nAfter authorizing, you will be redirected back to the server which handles the callback automatically.`,
          },
        ],
      };
    },
  };

  return handlers;
}

