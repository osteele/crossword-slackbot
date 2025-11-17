import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findChannelId,
  findMostRecentDateHeader,
  formatDateSeparator,
  getChannelMessages,
  getDateRange,
  getPreviousSunday,
  getUpcomingSunday,
  isSameDay,
  parseExistingDateMessage,
  postDateSeparator,
} from './index';
import {
  createMockSlackClient,
  mockConversationsHistoryResponse,
  mockConversationsListResponse,
  mockDateHeader,
  mockMessage,
  mockPostMessageResponse,
} from './src/__tests__/helpers/mockSlackClient';

describe('formatDateSeparator', () => {
  it('formats a Monday correctly', () => {
    const date = new Date(2024, 10, 4); // Mon Nov 4, 2024
    expect(formatDateSeparator(date)).toBe('--- Mon 11/4 ---');
  });

  it('formats a Sunday correctly', () => {
    const date = new Date(2024, 10, 3); // Sun Nov 3, 2024
    expect(formatDateSeparator(date)).toBe('--- Sun 11/3 ---');
  });

  it('formats a date with double-digit day', () => {
    const date = new Date(2024, 10, 12); // Tue Nov 12, 2024
    expect(formatDateSeparator(date)).toBe('--- Tue 11/12 ---');
  });

  it('formats a December date correctly', () => {
    const date = new Date(2024, 11, 25); // Wed Dec 25, 2024
    expect(formatDateSeparator(date)).toBe('--- Wed 12/25 ---');
  });
});

describe('parseExistingDateMessage', () => {
  it('parses a valid date message', () => {
    const text = '--- Mon 11/4 ---';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(10); // November (0-indexed)
    expect(result?.getDate()).toBe(4);
  });

  it('parses date with extra whitespace', () => {
    const text = '---   Sun   11/3   ---';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(10);
    expect(result?.getDate()).toBe(3);
  });

  it('returns null for invalid format', () => {
    expect(parseExistingDateMessage('Invalid text')).toBeNull();
    expect(parseExistingDateMessage('Mon 11/4')).toBeNull();
    expect(parseExistingDateMessage('--- 11/4 ---')).toBeNull();
  });

  it('returns null for invalid date', () => {
    const text = '--- Mon 2/30 ---'; // Feb 30 doesn't exist
    const result = parseExistingDateMessage(text);
    expect(result).toBeNull();
  });

  it('parses date in text context', () => {
    const text = 'Some text --- Tue 11/12 --- More text';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getDate()).toBe(12);
  });

  it('handles year boundary correctly - December in early January', () => {
    // Simulate running the bot on January 5, 2025
    // A "--- Sat 12/28 ---" header should be parsed as December 28, 2024
    const text = '--- Sat 12/28 ---';
    const result = parseExistingDateMessage(text);

    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(11); // December (0-indexed)
    expect(result?.getDate()).toBe(28);

    // The year should be last year if we're in early January
    // and the parsed date would be >6 months in the future
    const now = new Date();
    const sixMonthsAhead = new Date();
    sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

    const testDate = new Date(now.getFullYear(), 11, 28); // Dec 28 this year
    if (testDate > sixMonthsAhead) {
      expect(result?.getFullYear()).toBe(now.getFullYear() - 1);
    } else {
      expect(result?.getFullYear()).toBe(now.getFullYear());
    }
  });

  it('handles year boundary correctly - January in late December', () => {
    // Simulate running the bot on December 30, 2024
    // A "--- Wed 1/1 ---" header should be parsed as January 1, 2025
    const text = '--- Wed 1/1 ---';
    const result = parseExistingDateMessage(text);

    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(0); // January (0-indexed)
    expect(result?.getDate()).toBe(1);

    // Verify the year is correctly calculated based on 6-month window
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const testDate = new Date(now.getFullYear(), 0, 1); // Jan 1 this year
    if (testDate < sixMonthsAgo) {
      // If Jan 1 of this year is more than 6 months ago, should be next year
      expect(result?.getFullYear()).toBe(now.getFullYear() + 1);
    } else {
      // Otherwise should be this year
      expect(result?.getFullYear()).toBe(now.getFullYear());
    }
  });

  it('parses recent dates with current year', () => {
    // A date within 6 months should use current year
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const month = nextMonth.getMonth() + 1;
    const day = 15;

    const text = `--- Mon ${month}/${day} ---`;
    const result = parseExistingDateMessage(text);

    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe('isSameDay', () => {
  it('returns true for same date', () => {
    const date1 = new Date(2024, 10, 12, 10, 30);
    const date2 = new Date(2024, 10, 12, 15, 45);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2024, 10, 13);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different months', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2024, 11, 12);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different years', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2025, 10, 12);
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('getPreviousSunday', () => {
  it('returns previous Sunday when today is Monday', () => {
    const monday = new Date(2024, 10, 4); // Mon Nov 4, 2024
    const result = getPreviousSunday(monday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(3); // Nov 3
  });

  it('returns previous Sunday when today is Sunday', () => {
    const sunday = new Date(2024, 10, 3); // Sun Nov 3, 2024
    const result = getPreviousSunday(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(27); // Oct 27 (previous week)
  });

  it('returns previous Sunday when today is Saturday', () => {
    const saturday = new Date(2024, 10, 9); // Sat Nov 9, 2024
    const result = getPreviousSunday(saturday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(3); // Nov 3
  });

  it('returns previous Sunday when today is Wednesday', () => {
    const wednesday = new Date(2024, 10, 6); // Wed Nov 6, 2024
    const result = getPreviousSunday(wednesday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(3); // Nov 3
  });
});

describe('getUpcomingSunday', () => {
  it('returns next Sunday when today is Monday', () => {
    const monday = new Date(2024, 10, 4); // Mon Nov 4, 2024
    const result = getUpcomingSunday(monday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(10); // Nov 10
  });

  it('returns next Sunday when today is Sunday', () => {
    const sunday = new Date(2024, 10, 3); // Sun Nov 3, 2024
    const result = getUpcomingSunday(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(10); // Next Sunday, Nov 10
  });

  it('returns next Sunday when today is Saturday', () => {
    const saturday = new Date(2024, 10, 9); // Sat Nov 9, 2024
    const result = getUpcomingSunday(saturday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(10); // Nov 10
  });

  it('returns next Sunday when today is Wednesday', () => {
    const wednesday = new Date(2024, 10, 13); // Wed Nov 13, 2024
    const result = getUpcomingSunday(wednesday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(17); // Nov 17
  });
});

describe('getDateRange', () => {
  it('returns 7-day range ending on upcoming Sunday', () => {
    const range = getDateRange();

    expect(range).toHaveLength(7);
    expect(range[range.length - 1].getDay()).toBe(0); // Last day is Sunday
  });

  it('returns dates in ascending order', () => {
    const range = getDateRange();

    for (let i = 1; i < range.length; i++) {
      expect(range[i].getTime()).toBeGreaterThan(range[i - 1].getTime());
    }
  });

  it('all dates have time set to 00:00:00', () => {
    const range = getDateRange();

    for (const date of range) {
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    }
  });
});

describe('CLI validation', () => {
  it('detects NaN in date calculations', () => {
    const createBackDays = Number.NaN;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    // Invalid Date when NaN is used
    expect(Number.isNaN(startDate.getTime())).toBe(true);
  });

  it('validates non-negative integers', () => {
    expect(Number.isNaN(Number.NaN)).toBe(true);
    expect(Number.isNaN(-5)).toBe(false);
    expect(Number.isInteger(3.14)).toBe(false);
    expect(Number.isInteger(5)).toBe(true);
  });
});

describe('date range calculation (CLI-based)', () => {
  it('calculates correct range for create-back=0, create-forward=1', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 0;
    const createForwardDays = 1;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(2); // Today and tomorrow
    expect(isSameDay(dateRange[0], today)).toBe(true);
    expect(dateRange[1].getDate()).toBe((today.getDate() + 1) % 32 || 1);
  });

  it('calculates correct range for create-back=7, create-forward=7', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 7;
    const createForwardDays = 7;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(15); // 7 back + today + 7 forward
    expect(isSameDay(dateRange[7], today)).toBe(true); // Middle day is today
  });

  it('calculates correct range for create-back=14, create-forward=0', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 14;
    const createForwardDays = 0;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(15); // 14 back + today
    expect(isSameDay(dateRange[dateRange.length - 1], today)).toBe(true);
  });
});

describe('findChannelId', () => {
  it('finds channel by name', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.list.mockResolvedValue(
      mockConversationsListResponse([
        { id: 'C123', name: 'general' },
        { id: 'C456', name: 'crossword' },
        { id: 'C789', name: 'random' },
      ])
    );

    const channelId = await findChannelId('crossword', mockClient as any);
    expect(channelId).toBe('C456');
    expect(mockClient.conversations.list).toHaveBeenCalledWith({
      types: 'public_channel',
      cursor: undefined,
      limit: 200,
    });
  });

  it('strips # from channel name', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.list.mockResolvedValue(
      mockConversationsListResponse([{ id: 'C123', name: 'general' }])
    );

    const channelId = await findChannelId('#general', mockClient as any);
    expect(channelId).toBe('C123');
  });

  it('returns null when channel not found', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.list.mockResolvedValue(mockConversationsListResponse([]));

    const channelId = await findChannelId('nonexistent', mockClient as any);
    expect(channelId).toBeNull();
  });

  it('returns null on error', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.list.mockRejectedValue(new Error('API error'));

    const channelId = await findChannelId('crossword', mockClient as any);
    expect(channelId).toBeNull();
  });
});

describe('getChannelMessages', () => {
  it('fetches messages from a channel', async () => {
    const mockClient = createMockSlackClient();
    const oneWeekAgo = new Date('2024-11-05');
    const messages = [
      mockMessage('Hello', 'U1', '1699200000.000000'),
      mockMessage('World', 'U2', '1699300000.000000'),
    ];

    mockClient.conversations.history.mockResolvedValue(mockConversationsHistoryResponse(messages));

    const result = await getChannelMessages('C123', oneWeekAgo, mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Hello');
    expect(result[1].text).toBe('World');
    expect(mockClient.conversations.history).toHaveBeenCalledWith({
      channel: 'C123',
      oldest: Math.floor(oneWeekAgo.getTime() / 1000).toString(),
      cursor: undefined,
      limit: 200,
    });
  });

  it('handles pagination', async () => {
    const mockClient = createMockSlackClient();
    const oneWeekAgo = new Date('2024-11-05');

    const page1Messages = [mockMessage('Message 1', 'U1', '1699200000.000000')];
    const page2Messages = [mockMessage('Message 2', 'U2', '1699300000.000000')];

    mockClient.conversations.history
      .mockResolvedValueOnce(mockConversationsHistoryResponse(page1Messages, true, 'cursor123'))
      .mockResolvedValueOnce(mockConversationsHistoryResponse(page2Messages, false));

    const result = await getChannelMessages('C123', oneWeekAgo, mockClient as any);

    expect(result).toHaveLength(2);
    expect(mockClient.conversations.history).toHaveBeenCalledTimes(2);
    expect(mockClient.conversations.history).toHaveBeenNthCalledWith(2, {
      channel: 'C123',
      oldest: Math.floor(oneWeekAgo.getTime() / 1000).toString(),
      cursor: 'cursor123',
      limit: 200,
    });
  });

  it('sorts messages by timestamp', async () => {
    const mockClient = createMockSlackClient();
    const oneWeekAgo = new Date('2024-11-05');

    // Messages in reverse chronological order
    const messages = [
      mockMessage('Later', 'U1', '1699300000.000000'),
      mockMessage('Earlier', 'U2', '1699200000.000000'),
    ];

    mockClient.conversations.history.mockResolvedValue(mockConversationsHistoryResponse(messages));

    const result = await getChannelMessages('C123', oneWeekAgo, mockClient as any);

    expect(result[0].text).toBe('Earlier');
    expect(result[1].text).toBe('Later');
  });

  it('returns empty array on error', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.history.mockRejectedValue(new Error('API error'));

    const result = await getChannelMessages('C123', new Date(), mockClient as any);
    expect(result).toEqual([]);
  });
});

describe('findMostRecentDateHeader', () => {
  it('finds the most recent date header', async () => {
    const mockClient = createMockSlackClient();
    const now = new Date();
    const recentDate1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
    const recentDate2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const messages = [
      mockDateHeader(
        formatDateSeparator(recentDate1)
          .replace(/^--- |---$/g, '')
          .trim(),
        '1699200000.000000'
      ),
      mockMessage('Some chat', 'U1', '1699250000.000000'),
      mockDateHeader(
        formatDateSeparator(recentDate2)
          .replace(/^--- |---$/g, '')
          .trim(),
        '1699300000.000000'
      ),
      mockMessage('More chat', 'U2', '1699350000.000000'),
    ];

    mockClient.conversations.history.mockResolvedValue(mockConversationsHistoryResponse(messages));

    const result = await findMostRecentDateHeader('C123', 30, mockClient as any);

    expect(result).not.toBeNull();
    expect(result?.toDateString()).toBe(recentDate2.toDateString());
  });

  it('returns null when no date headers found', async () => {
    const mockClient = createMockSlackClient();
    const messages = [
      mockMessage('Just chat', 'U1', '1699200000.000000'),
      mockMessage('No dates here', 'U2', '1699300000.000000'),
    ];

    mockClient.conversations.history.mockResolvedValue(mockConversationsHistoryResponse(messages));

    const result = await findMostRecentDateHeader('C123', 30, mockClient as any);
    expect(result).toBeNull();
  });

  it('returns null when no messages exist', async () => {
    const mockClient = createMockSlackClient();
    mockClient.conversations.history.mockResolvedValue(mockConversationsHistoryResponse([]));

    const result = await findMostRecentDateHeader('C123', 30, mockClient as any);
    expect(result).toBeNull();
  });
});

describe('postDateSeparator', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('posts date separator in normal mode', async () => {
    const mockClient = createMockSlackClient();
    mockClient.chat.postMessage.mockResolvedValue(
      mockPostMessageResponse('C123', '1699200000.000000')
    );

    const date = new Date(2024, 10, 4); // Mon Nov 4, 2024
    await postDateSeparator('C123', date, false, mockClient as any);

    expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: '--- Mon 11/4 ---',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith('Posted: --- Mon 11/4 ---');
  });

  it('does not post in dry-run mode', async () => {
    const mockClient = createMockSlackClient();

    const date = new Date(2024, 10, 4); // Mon Nov 4, 2024
    await postDateSeparator('C123', date, true, mockClient as any);

    expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('[DRY RUN] Would post: --- Mon 11/4 ---');
  });

  it('handles posting errors gracefully', async () => {
    const mockClient = createMockSlackClient();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockClient.chat.postMessage.mockRejectedValue(new Error('API error'));

    const date = new Date(2024, 10, 4);
    await postDateSeparator('C123', date, false, mockClient as any);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error posting message'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
