// Mock helper for Slack Web API client
import { vi } from 'vitest';

export interface MockSlackClient {
  conversations: {
    history: ReturnType<typeof vi.fn>;
    replies: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  chat: {
    postMessage: ReturnType<typeof vi.fn>;
  };
  users: {
    info: ReturnType<typeof vi.fn>;
  };
}

/**
 * Create a mock Slack client with common API methods
 */
export function createMockSlackClient(): MockSlackClient {
  return {
    conversations: {
      history: vi.fn(),
      replies: vi.fn(),
      list: vi.fn(),
    },
    chat: {
      postMessage: vi.fn(),
    },
    users: {
      info: vi.fn(),
    },
  };
}

/**
 * Create a mock user info response
 */
export function mockUserInfo(userId: string, realName: string) {
  return {
    ok: true,
    user: {
      id: userId,
      name: realName.toLowerCase().replace(/\s+/g, ''),
      real_name: realName,
    },
  };
}

/**
 * Create a mock message
 */
export function mockMessage(text: string, user?: string, ts?: string) {
  return {
    text,
    ...(user && { user }),
    ...(ts && { ts }),
  };
}

/**
 * Create a mock date header message
 */
export function mockDateHeader(dateStr: string, ts: string) {
  return mockMessage(`--- ${dateStr} ---`, undefined, ts);
}

/**
 * Create a mock conversations.list response
 */
export function mockConversationsListResponse(channels: Array<{ id: string; name: string }>) {
  return {
    ok: true,
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_channel: true,
      is_private: false,
    })),
  };
}

/**
 * Create a mock conversations.history response
 */
export function mockConversationsHistoryResponse(
  messages: Array<{ text: string; ts: string; user?: string }>,
  hasMore = false,
  nextCursor?: string
) {
  return {
    ok: true,
    messages,
    has_more: hasMore,
    response_metadata: nextCursor ? { next_cursor: nextCursor } : undefined,
  };
}

/**
 * Create a mock chat.postMessage response
 */
export function mockPostMessageResponse(channel: string, ts: string) {
  return {
    ok: true,
    channel,
    ts,
  };
}
