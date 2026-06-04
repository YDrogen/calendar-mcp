import { describe, it, expect } from 'vitest';
import { AllToolDefinitions, setCalendarService, setTasksService } from '../tools/definitions';
import { AllToolSchemas } from '../types/tools';

describe('Tool Definitions - Schema Tests', () => {
  it('should export 27 tool definitions', () => {
    expect(AllToolDefinitions).toHaveLength(27);
  });

  it('should have all required CRUD tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('list_events');
    expect(names).toContain('get_event');
    expect(names).toContain('create_event');
    expect(names).toContain('update_event');
    expect(names).toContain('delete_event');
  });

  it('should have recurring event tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('list_event_instances');
    expect(names).toContain('create_recurring_event');
  });

  it('should have free/busy and calendar tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('query_free_busy');
    expect(names).toContain('list_calendars');
    expect(names).toContain('get_calendar');
  });

  it('should have webhook tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('subscribe_calendar');
    expect(names).toContain('unsubscribe_calendar');
    expect(names).toContain('list_subscriptions');
  });

  it('should have utility tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('search_events');
    expect(names).toContain('get_current_time');
  });

  it('should have task list tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('list_task_lists');
    expect(names).toContain('get_task_list');
    expect(names).toContain('create_task_list');
    expect(names).toContain('update_task_list');
    expect(names).toContain('delete_task_list');
  });

  it('should have task tool definitions', () => {
    const names = AllToolDefinitions.map((d) => d.name);
    expect(names).toContain('list_tasks');
    expect(names).toContain('get_task');
    expect(names).toContain('create_task');
    expect(names).toContain('update_task');
    expect(names).toContain('delete_task');
    expect(names).toContain('complete_task');
    expect(names).toContain('move_task');
  });

  it('should have correct schemas for each tool definition', () => {
    for (const def of AllToolDefinitions) {
      expect(def.inputSchema).toBeDefined();
      expect(AllToolSchemas).toHaveProperty(def.name);
      expect(def.inputSchema).toBe(AllToolSchemas[def.name as keyof typeof AllToolSchemas]);
    }
  });

  it('should have descriptions for all tool definitions', () => {
    for (const def of AllToolDefinitions) {
      expect(def.description).toBeDefined();
      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('should have handlers for all tool definitions', () => {
    for (const def of AllToolDefinitions) {
      expect(def.handler).toBeDefined();
      expect(typeof def.handler).toBe('function');
    }
  });

  describe('annotations', () => {
    it('should mark read operations with readOnlyHint', () => {
      const readOnlyTools = [
        'list_events',
        'get_event',
        'list_event_instances',
        'query_free_busy',
        'list_calendars',
        'get_calendar',
        'list_subscriptions',
        'search_events',
        'get_current_time',
        'list_task_lists',
        'get_task_list',
        'list_tasks',
        'get_task',
      ];

      for (const toolName of readOnlyTools) {
        const def = AllToolDefinitions.find((d) => d.name === toolName);
        expect(def).toBeDefined();
        expect(def?.annotations?.readOnlyHint).toBe(true);
      }
    });

    it('should mark destructive operations with destructiveHint', () => {
      const destructiveTools = ['delete_event', 'unsubscribe_calendar', 'delete_task_list', 'delete_task'];

      for (const toolName of destructiveTools) {
        const def = AllToolDefinitions.find((d) => d.name === toolName);
        expect(def).toBeDefined();
        expect(def?.annotations?.destructiveHint).toBe(true);
      }
    });

    it('should not mark create/update operations as readOnly or destructive', () => {
      const neutralTools = [
        'create_event',
        'update_event',
        'create_recurring_event',
        'subscribe_calendar',
      ];

      for (const toolName of neutralTools) {
        const def = AllToolDefinitions.find((d) => d.name === toolName);
        expect(def).toBeDefined();
        expect(def?.annotations?.readOnlyHint).not.toBe(true);
        expect(def?.annotations?.destructiveHint).not.toBe(true);
      }
    });
  });

  describe('handler integration', () => {
    it('should return error response when handler is called without CalendarService', async () => {
      const def = AllToolDefinitions.find((d) => d.name === 'list_events');
      expect(def).toBeDefined();

      const result = await def!.handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('CalendarService not initialized');
    });

    it('should work when CalendarService is set', async () => {
      const mockCalendarService = {
        listEvents: async () => [{ id: '1', summary: 'Test' }],
      };
      const mockTasksService = {
        listTaskLists: async () => [{ id: '1', title: 'Test List' }],
      };
      setCalendarService(mockCalendarService as unknown as ReturnType<typeof import('../tools/definitions').setCalendarService> extends (s: infer S) => void ? S : never);
      setTasksService(mockTasksService as unknown as ReturnType<typeof import('../tools/definitions').setTasksService> extends (s: infer S) => void ? S : never);

      const def = AllToolDefinitions.find((d) => d.name === 'list_events');
      const result = await def!.handler({});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      setCalendarService(null as unknown as ReturnType<typeof import('../tools/definitions').setCalendarService> extends (s: infer S) => void ? S : never);
      setTasksService(null as unknown as ReturnType<typeof import('../tools/definitions').setTasksService> extends (s: infer S) => void ? S : never);
    });
  });
});
