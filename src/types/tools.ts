import { z } from 'zod';

const ISO8601String = z.string().describe('ISO 8601 datetime string');
const CalendarIdString = z
  .string()
  .describe(
    'Google Calendar ID (email format for user calendar, or calendar list ID)'
  );
const EventIdString = z.string().describe('Unique event ID');
const ChannelIdString = z.string().describe('Webhook channel ID');

// Event CRUD schemas

export const ListEventsSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    timeMin: ISO8601String.optional().describe(
      'Start of time range (RFC 3339 format)'
    ),
    timeMax: ISO8601String.optional().describe(
      'End of time range (RFC 3339 format)'
    ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum number of events to return (max 250)'),
    q: z
      .string()
      .optional()
      .describe('Free text search query for event title/description'),
  })
  .describe('List events in a calendar with optional filtering');

export const GetEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to retrieve'),
  })
  .describe('Get details of a single event');

export const CreateEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    summary: z.string().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional().describe('Date in YYYY-MM-DD format'),
        timeZone: z.string().optional(),
      })
      .describe('Event start time (dateTime for timed, date for all-day)'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional().describe('Date in YYYY-MM-DD format'),
        timeZone: z.string().optional(),
      })
      .describe('Event end time'),
    attendees: z
      .array(
        z.object({
          email: z.string().email().describe('Attendee email'),
          displayName: z.string().optional().describe('Attendee display name'),
        })
      )
      .optional()
      .describe('List of attendees'),
    recurrence: z
      .array(z.string())
      .optional()
      .describe('Recurrence rules (RRULE strings, e.g., "RRULE:FREQ=WEEKLY")'),
  })
  .describe('Create a new event');

export const UpdateEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to update'),
    summary: z.string().optional().describe('Updated event title'),
    description: z.string().optional().describe('Updated description'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .optional()
      .describe('Updated start time'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .optional()
      .describe('Updated end time'),
  })
  .describe('Update an existing event (partial update)');

export const DeleteEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to delete'),
  })
  .describe('Delete an event');

// Recurring event schemas

export const ListEventInstancesSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Recurring event ID'),
    timeMin: ISO8601String.optional().describe(
      'Start of time range for instances'
    ),
    timeMax: ISO8601String.optional().describe(
      'End of time range for instances'
    ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum instances to return'),
  })
  .describe('List individual instances of a recurring event');

export const CreateRecurringEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    summary: z.string().describe('Event title'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .describe('Event start time'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .describe('Event end time'),
    recurrence: z
      .array(z.string())
      .min(1)
      .describe(
        'Recurrence rules as RRULE strings (e.g., ["RRULE:FREQ=WEEKLY;COUNT=10"])'
      ),
    description: z.string().optional().describe('Event description'),
  })
  .describe('Create a recurring event');

// Free/busy schema

export const QueryFreeBusySchema = z
  .object({
    calendarIds: z
      .array(CalendarIdString)
      .min(1)
      .max(50)
      .describe('Calendar IDs to query (max 50)'),
    timeMin: ISO8601String.describe('Start of time range'),
    timeMax: ISO8601String.describe('End of time range'),
    timeZone: z
      .string()
      .optional()
      .describe('Timezone for response (defaults to UTC)'),
  })
  .describe('Query free/busy availability for multiple calendars');

// Calendar management schemas

export const ListCalendarsSchema = z
  .object({})
  .describe('List all calendars in the user account');

export const GetCalendarSchema = z
  .object({
    calendarId: CalendarIdString.describe('Calendar ID'),
  })
  .describe('Get details of a single calendar');

// Webhook subscription schemas

export const SubscribeCalendarSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    webhookUrl: z.string().url().describe('Webhook endpoint URL for push notifications'),
  })
  .describe(
    'Subscribe to push notifications for calendar changes (7-day expiry)'
  );

export const UnsubscribeCalendarSchema = z
  .object({
    channelId: ChannelIdString.describe('Webhook channel ID to unsubscribe'),
  })
  .describe('Unsubscribe from calendar push notifications');

export const ListSubscriptionsSchema = z
  .object({})
  .describe('List active webhook subscriptions');

// Utility schemas

export const SearchEventsSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    q: z.string().describe('Search query string'),
    timeMin: ISO8601String.optional().describe('Start of time range'),
    timeMax: ISO8601String.optional().describe('End of time range'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum results to return'),
  })
  .describe('Full-text search events in a calendar');

export const GetCurrentTimeSchema = z
  .object({})
  .describe('Get current server time with timezone context');

export const ListTaskListsSchema = z
  .object({})
  .describe('List all task lists in the user account');

export const GetTaskListSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
  })
  .describe('Get details of a single task list');

export const CreateTaskListSchema = z
  .object({
    title: z.string().describe('Task list title (max 1024 chars)'),
  })
  .describe('Create a new task list');

export const UpdateTaskListSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    title: z.string().describe('Updated task list title'),
  })
  .describe('Update a task list title');

export const DeleteTaskListSchema = z
  .object({
    listId: z.string().describe('Task list ID to delete'),
  })
  .describe('Delete a task list and all its tasks');

export const ListTasksSchema = z
  .object({
    listId: z.string().optional().describe('Task list ID (defaults to @default)'),
    showCompleted: z.boolean().optional().describe('Include completed tasks (default true)'),
    showHidden: z.boolean().optional().describe('Include hidden tasks (default false)'),
    dueMin: ISO8601String.optional().describe('Filter tasks due after this date'),
    dueMax: ISO8601String.optional().describe('Filter tasks due before this date'),
  })
  .describe('List tasks in a task list');

export const GetTaskSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    taskId: z.string().describe('Task ID'),
  })
  .describe('Get details of a single task');

export const CreateTaskSchema = z
  .object({
    listId: z.string().optional().describe('Task list ID (defaults to @default)'),
    title: z.string().describe('Task title (max 1024 chars)'),
    notes: z.string().optional().describe('Task notes (max 8192 chars)'),
    due: ISO8601String.optional().describe('Due date (RFC 3339 date-only, e.g., 2026-06-10)'),
    parent: z.string().optional().describe('Parent task ID for subtasks'),
  })
  .describe('Create a new task');

export const UpdateTaskSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    taskId: z.string().describe('Task ID'),
    title: z.string().optional().describe('Updated task title'),
    notes: z.string().optional().describe('Updated notes'),
    due: ISO8601String.optional().describe('Updated due date'),
    status: z.enum(['needsAction', 'completed']).optional().describe('Task status'),
  })
  .describe('Update an existing task (partial update)');

export const DeleteTaskSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    taskId: z.string().describe('Task ID to delete'),
  })
  .describe('Delete a task');

export const CompleteTaskSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    taskId: z.string().describe('Task ID to mark as completed'),
  })
  .describe('Mark a task as completed');

export const MoveTaskSchema = z
  .object({
    listId: z.string().describe('Task list ID'),
    taskId: z.string().describe('Task ID to move'),
    parent: z.string().optional().describe('New parent task ID'),
    previous: z.string().optional().describe('Task ID to position after'),
  })
  .describe('Move a task to a new position or parent');

export const AuthenticateSchema = z
  .object({})
  .describe(
    'Start Google OAuth2 authentication. Returns a URL to open in your browser. After signing in, tokens are saved automatically.'
  );

// Type exports for consuming code
export type ListEventsInput = z.infer<typeof ListEventsSchema>;
export type GetEventInput = z.infer<typeof GetEventSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type DeleteEventInput = z.infer<typeof DeleteEventSchema>;
export type ListEventInstancesInput = z.infer<typeof ListEventInstancesSchema>;
export type CreateRecurringEventInput = z.infer<
  typeof CreateRecurringEventSchema
>;
export type QueryFreeBusyInput = z.infer<typeof QueryFreeBusySchema>;
export type ListCalendarsInput = z.infer<typeof ListCalendarsSchema>;
export type GetCalendarInput = z.infer<typeof GetCalendarSchema>;
export type SubscribeCalendarInput = z.infer<typeof SubscribeCalendarSchema>;
export type UnsubscribeCalendarInput = z.infer<typeof UnsubscribeCalendarSchema>;
export type ListSubscriptionsInput = z.infer<typeof ListSubscriptionsSchema>;
export type SearchEventsInput = z.infer<typeof SearchEventsSchema>;
export type GetCurrentTimeInput = z.infer<typeof GetCurrentTimeSchema>;
export type ListTaskListsInput = z.infer<typeof ListTaskListsSchema>;
export type GetTaskListInput = z.infer<typeof GetTaskListSchema>;
export type CreateTaskListInput = z.infer<typeof CreateTaskListSchema>;
export type UpdateTaskListInput = z.infer<typeof UpdateTaskListSchema>;
export type DeleteTaskListInput = z.infer<typeof DeleteTaskListSchema>;
export type ListTasksInput = z.infer<typeof ListTasksSchema>;
export type GetTaskInput = z.infer<typeof GetTaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type DeleteTaskInput = z.infer<typeof DeleteTaskSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;
export type AuthenticateInput = z.infer<typeof AuthenticateSchema>;

export const AllToolSchemas = {
  list_events: ListEventsSchema,
  get_event: GetEventSchema,
  create_event: CreateEventSchema,
  update_event: UpdateEventSchema,
  delete_event: DeleteEventSchema,
  list_event_instances: ListEventInstancesSchema,
  create_recurring_event: CreateRecurringEventSchema,
  query_free_busy: QueryFreeBusySchema,
  list_calendars: ListCalendarsSchema,
  get_calendar: GetCalendarSchema,
  subscribe_calendar: SubscribeCalendarSchema,
  unsubscribe_calendar: UnsubscribeCalendarSchema,
  list_subscriptions: ListSubscriptionsSchema,
  search_events: SearchEventsSchema,
  get_current_time: GetCurrentTimeSchema,
  list_task_lists: ListTaskListsSchema,
  get_task_list: GetTaskListSchema,
  create_task_list: CreateTaskListSchema,
  update_task_list: UpdateTaskListSchema,
  delete_task_list: DeleteTaskListSchema,
  list_tasks: ListTasksSchema,
  get_task: GetTaskSchema,
  create_task: CreateTaskSchema,
  update_task: UpdateTaskSchema,
  delete_task: DeleteTaskSchema,
  complete_task: CompleteTaskSchema,
  move_task: MoveTaskSchema,
  authenticate: AuthenticateSchema,
} as const;
