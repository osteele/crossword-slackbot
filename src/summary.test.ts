import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSlackClient,
  type MockSlackClient,
  mockDateHeader,
  mockMessage,
  mockUserInfo,
} from './__tests__/helpers/mockSlackClient';
import { formatSummaryMessage, generateWeeklySummary } from './summary';

describe('generateWeeklySummary', () => {
  let mockClient: MockSlackClient;

  beforeEach(() => {
    mockClient = createMockSlackClient();
  });

  it('calculates current week statistics correctly', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockDateHeader('Tue 11/5', '1699171200.000000'),
      ],
    });

    mockClient.conversations.replies
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', '1699084800.000000'),
          mockMessage('2:00', 'U001', '1699084900.000000'), // 120 seconds
          mockMessage('4:00', 'U002', '1699085000.000000'), // 240 seconds
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Tue 11/5', '1699171200.000000'),
          mockMessage('3:00', 'U001', '1699171300.000000'), // 180 seconds
        ],
      });

    mockClient.users.info
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'))
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.totalSolves).toBe(3);
    expect(result.currentWeek.averageTime).toBe(180); // (120 + 240 + 180) / 3
    expect(result.currentWeek.participantCount).toBe(2); // Alice and Bob
    expect(result.currentWeek.fastestTime).toBe(120);
    expect(result.currentWeek.slowestTime).toBe(240);
  });

  it('compares current week to last week', async () => {
    // Mock current week with 2 solves, avg 150s
    mockClient.conversations.history
      .mockResolvedValueOnce({
        messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
      })
      .mockResolvedValueOnce({
        messages: [mockDateHeader('Mon 10/28', '1698480000.000000')],
      });

    mockClient.conversations.replies
      // Current week
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', '1699084800.000000'),
          mockMessage('2:00', 'U001', '1699084900.000000'),
          mockMessage('3:00', 'U002', '1699085000.000000'),
        ],
      })
      // Last week
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 10/28', '1698480000.000000'),
          mockMessage('4:00', 'U001', '1698480100.000000'),
          mockMessage('5:00', 'U002', '1698480200.000000'),
        ],
      });

    mockClient.users.info
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'))
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.totalSolves).toBe(2);
    expect(result.currentWeek.averageTime).toBe(150); // (120 + 180) / 2
    expect(result.lastWeek.totalSolves).toBe(2);
    expect(result.lastWeek.averageTime).toBe(270); // (240 + 300) / 2
  });

  it('generates fun facts for fastest solve', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('0:25', 'U001', '1699084900.000000'), // Fast time!
      ],
    });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U001', 'Alice'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.funFacts.length).toBeGreaterThan(0);
    expect(result.funFacts.some((fact) => fact.includes('Fastest solve'))).toBe(true);
    expect(result.funFacts.some((fact) => fact.includes('Alice'))).toBe(true);
  });

  it('generates fun fact for speed improvement', async () => {
    mockClient.conversations.history
      .mockResolvedValueOnce({
        messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
      })
      .mockResolvedValueOnce({
        messages: [mockDateHeader('Mon 10/28', '1698480000.000000')],
      });

    mockClient.conversations.replies
      // Current week - fast times
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', '1699084800.000000'),
          mockMessage('1:00', 'U001', '1699084900.000000'),
        ],
      })
      // Last week - slower times
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 10/28', '1698480000.000000'),
          mockMessage('3:00', 'U001', '1698480100.000000'),
        ],
      });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U001', 'Alice'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    // Should mention improvement
    expect(result.funFacts.some((fact) => fact.includes('faster'))).toBe(true);
  });

  it('handles no solves in current week', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [],
    });

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.totalSolves).toBe(0);
    expect(result.currentWeek.averageTime).toBe(0);
    expect(result.currentWeek.participantCount).toBe(0);
    expect(result.funFacts).toHaveLength(0);
  });

  it('handles no solves in last week', async () => {
    mockClient.conversations.history
      .mockResolvedValueOnce({
        messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
      })
      .mockResolvedValueOnce({
        messages: [], // No last week data
      });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('2:00', 'U001', '1699084900.000000'),
      ],
    });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U001', 'Alice'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.totalSolves).toBe(1);
    expect(result.lastWeek.totalSolves).toBe(0);
    expect(result.lastWeek.averageTime).toBe(0);
  });

  it('counts unique participants correctly', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockDateHeader('Tue 11/5', '1699171200.000000'),
      ],
    });

    mockClient.conversations.replies
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', '1699084800.000000'),
          mockMessage('2:00', 'U001', '1699084900.000000'),
          mockMessage('3:00', 'U001', '1699085000.000000'), // Same user, different time
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Tue 11/5', '1699171200.000000'),
          mockMessage('2:30', 'U002', '1699171300.000000'),
        ],
      });

    mockClient.users.info
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.participantCount).toBe(2); // Only unique users
  });

  it('handles messages without valid times', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('Great puzzle!', 'U001', '1699084900.000000'),
        mockMessage('2:00', 'U002', '1699085000.000000'),
        mockMessage('invalid time', 'U003', '1699085100.000000'),
      ],
    });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U002', 'Bob'));

    const result = await generateWeeklySummary(mockClient as any, 'C12345');

    expect(result.currentWeek.totalSolves).toBe(1);
    expect(result.currentWeek.participantCount).toBe(1);
  });
});

describe('formatSummaryMessage', () => {
  it('formats summary with current week stats', () => {
    const summary = {
      currentWeek: {
        totalSolves: 10,
        averageTime: 180,
        participantCount: 5,
        fastestTime: 60,
        slowestTime: 300,
      },
      lastWeek: {
        totalSolves: 0,
        averageTime: 0,
      },
      funFacts: [],
    };

    const message = formatSummaryMessage(summary);

    expect(message).toContain('📊 Weekly Crossword Summary');
    expect(message).toContain('This Week:');
    expect(message).toContain('Total solves: 10');
    expect(message).toContain('Average time: 3:00');
    expect(message).toContain('Participants: 5');
    expect(message).toContain('Range: 1:00 - 5:00');
  });

  it('shows comparison to last week', () => {
    const summary = {
      currentWeek: {
        totalSolves: 10,
        averageTime: 180,
        participantCount: 5,
        fastestTime: 60,
        slowestTime: 300,
      },
      lastWeek: {
        totalSolves: 8,
        averageTime: 200,
      },
      funFacts: [],
    };

    const message = formatSummaryMessage(summary);

    expect(message).toContain('Compared to Last Week:');
    expect(message).toContain('Solves: 10 (was 8)');
    expect(message).toContain('⬇️ faster'); // 200 - 180 = 20s faster
  });

  it('shows slower trend when applicable', () => {
    const summary = {
      currentWeek: {
        totalSolves: 10,
        averageTime: 220,
        participantCount: 5,
        fastestTime: 60,
        slowestTime: 300,
      },
      lastWeek: {
        totalSolves: 10,
        averageTime: 180,
      },
      funFacts: [],
    };

    const message = formatSummaryMessage(summary);

    expect(message).toContain('⬆️ slower'); // 180 - 220 = -40s slower
  });

  it('includes fun facts when present', () => {
    const summary = {
      currentWeek: {
        totalSolves: 10,
        averageTime: 180,
        participantCount: 5,
        fastestTime: 60,
        slowestTime: 300,
      },
      lastWeek: {
        totalSolves: 0,
        averageTime: 0,
      },
      funFacts: ['Fastest solve: 1:00 by Alice', 'Group is 30s faster than last week! 🚀'],
    };

    const message = formatSummaryMessage(summary);

    expect(message).toContain('Fun Facts:');
    expect(message).toContain('Fastest solve: 1:00 by Alice');
    expect(message).toContain('Group is 30s faster than last week! 🚀');
  });

  it('handles no solves gracefully', () => {
    const summary = {
      currentWeek: {
        totalSolves: 0,
        averageTime: 0,
        participantCount: 0,
        fastestTime: 0,
        slowestTime: 0,
      },
      lastWeek: {
        totalSolves: 0,
        averageTime: 0,
      },
      funFacts: [],
    };

    const message = formatSummaryMessage(summary);

    expect(message).toContain('No solve times recorded this week yet');
  });
});
