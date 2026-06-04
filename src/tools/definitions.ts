import { ToolDefinition } from '../types/mcp.js';
import {
  ListEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  ListEventInstancesSchema,
  CreateRecurringEventSchema,
  QueryFreeBusySchema,
  ListCalendarsSchema,
  GetCalendarSchema,
  SubscribeCalendarSchema,
  UnsubscribeCalendarSchema,
  ListSubscriptionsSchema,
  SearchEventsSchema,
  GetCurrentTimeSchema,
  ListTaskListsSchema,
  GetTaskListSchema,
  CreateTaskListSchema,
  UpdateTaskListSchema,
  DeleteTaskListSchema,
  ListTasksSchema,
  GetTaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  DeleteTaskSchema,
  CompleteTaskSchema,
  MoveTaskSchema,
} from '../types/tools.js';
import { createHandlers } from './handlers.js';
import type { CalendarService, TasksService } from './handlers.js';

let _calendarService: CalendarService | null = null;
let _tasksService: TasksService | null = null;

export function setCalendarService(service: CalendarService): void {
  _calendarService = service;
}

export function setTasksService(service: TasksService): void {
  _tasksService = service;
}

function getCalendarService(): CalendarService {
  if (!_calendarService) {
    throw new Error(
      'CalendarService not initialized. Call setCalendarService() before using tool handlers.'
    );
  }
  return _calendarService;
}

function getTasksService(): TasksService {
  if (!_tasksService) {
    throw new Error(
      'TasksService not initialized. Call setTasksService() before using tool handlers.'
    );
  }
  return _tasksService;
}

const lazyCalendarService: CalendarService = new Proxy({} as CalendarService, {
  get(_target, prop: string | symbol) {
    return async (...args: unknown[]) => {
      const service = getCalendarService();
      const method = service[prop as keyof CalendarService];
      if (typeof method !== 'function') {
        throw new Error(
          `Method ${String(prop)} is not a function on CalendarService`
        );
      }
      return (method as (...args: unknown[]) => unknown).call(service, ...args);
    };
  },
});

const lazyTasksService: TasksService = new Proxy({} as TasksService, {
  get(_target, prop: string | symbol) {
    return async (...args: unknown[]) => {
      const service = getTasksService();
      const method = service[prop as keyof TasksService];
      if (typeof method !== 'function') {
        throw new Error(
          `Method ${String(prop)} is not a function on TasksService`
        );
      }
      return (method as (...args: unknown[]) => unknown).call(service, ...args);
    };
  },
});

const handlers = createHandlers(lazyCalendarService, lazyTasksService);

export const AllToolDefinitions: ToolDefinition[] = [
  {
    name: 'list_events',
    description: 'List events in a calendar with optional filtering',
    inputSchema: ListEventsSchema,
    handler: handlers.list_events,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_event',
    description: 'Get details of a single event',
    inputSchema: GetEventSchema,
    handler: handlers.get_event,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_event',
    description: 'Create a new event',
    inputSchema: CreateEventSchema,
    handler: handlers.create_event,
  },
  {
    name: 'update_event',
    description: 'Update an existing event (partial update)',
    inputSchema: UpdateEventSchema,
    handler: handlers.update_event,
  },
  {
    name: 'delete_event',
    description: 'Delete an event',
    inputSchema: DeleteEventSchema,
    handler: handlers.delete_event,
    annotations: { destructiveHint: true },
  },
  {
    name: 'list_event_instances',
    description: 'List individual instances of a recurring event',
    inputSchema: ListEventInstancesSchema,
    handler: handlers.list_event_instances,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_recurring_event',
    description: 'Create a recurring event',
    inputSchema: CreateRecurringEventSchema,
    handler: handlers.create_recurring_event,
  },
  {
    name: 'query_free_busy',
    description: 'Query free/busy availability for multiple calendars',
    inputSchema: QueryFreeBusySchema,
    handler: handlers.query_free_busy,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_calendars',
    description: 'List all calendars in the user account',
    inputSchema: ListCalendarsSchema,
    handler: handlers.list_calendars,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_calendar',
    description: 'Get details of a single calendar',
    inputSchema: GetCalendarSchema,
    handler: handlers.get_calendar,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'subscribe_calendar',
    description:
      'Subscribe to push notifications for calendar changes (7-day expiry)',
    inputSchema: SubscribeCalendarSchema,
    handler: handlers.subscribe_calendar,
  },
  {
    name: 'unsubscribe_calendar',
    description: 'Unsubscribe from calendar push notifications',
    inputSchema: UnsubscribeCalendarSchema,
    handler: handlers.unsubscribe_calendar,
    annotations: { destructiveHint: true },
  },
  {
    name: 'list_subscriptions',
    description: 'List active webhook subscriptions',
    inputSchema: ListSubscriptionsSchema,
    handler: handlers.list_subscriptions,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'search_events',
    description: 'Full-text search events in a calendar',
    inputSchema: SearchEventsSchema,
    handler: handlers.search_events,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_current_time',
    description: 'Get current server time with timezone context',
    inputSchema: GetCurrentTimeSchema,
    handler: handlers.get_current_time,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_task_lists',
    description: 'List all task lists in the user account',
    inputSchema: ListTaskListsSchema,
    handler: handlers.list_task_lists,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_task_list',
    description: 'Get details of a single task list',
    inputSchema: GetTaskListSchema,
    handler: handlers.get_task_list,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_task_list',
    description: 'Create a new task list',
    inputSchema: CreateTaskListSchema,
    handler: handlers.create_task_list,
  },
  {
    name: 'update_task_list',
    description: 'Update a task list title',
    inputSchema: UpdateTaskListSchema,
    handler: handlers.update_task_list,
  },
  {
    name: 'delete_task_list',
    description: 'Delete a task list and all its tasks',
    inputSchema: DeleteTaskListSchema,
    handler: handlers.delete_task_list,
    annotations: { destructiveHint: true },
  },
  {
    name: 'list_tasks',
    description: 'List tasks in a task list',
    inputSchema: ListTasksSchema,
    handler: handlers.list_tasks,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_task',
    description: 'Get details of a single task',
    inputSchema: GetTaskSchema,
    handler: handlers.get_task,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: CreateTaskSchema,
    handler: handlers.create_task,
  },
  {
    name: 'update_task',
    description: 'Update an existing task (partial update)',
    inputSchema: UpdateTaskSchema,
    handler: handlers.update_task,
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: DeleteTaskSchema,
    handler: handlers.delete_task,
    annotations: { destructiveHint: true },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed',
    inputSchema: CompleteTaskSchema,
    handler: handlers.complete_task,
  },
  {
    name: 'move_task',
    description: 'Move a task to a new position or parent',
    inputSchema: MoveTaskSchema,
    handler: handlers.move_task,
  },
];
