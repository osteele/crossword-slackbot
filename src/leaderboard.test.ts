import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSlackClient,
  type MockSlackClient,
  mockDateHeader,
  mockMessage,
  mockUserInfo,
} from './__tests__/helpers/mockSlackClient';
import { formatLeaderboardMessage, generateLeaderboard } from './leaderboard';

describe('generateLeaderboard', () => {
  let mockClient: MockSlackClient;

  beforeEach(() => {
    mockClient = createMockSlackClient();
  });

  it('generates leaderboard with top times sorted by speed', async () => {
    // Mock conversations.history to return date headers
    mockClient.conversations.history.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockDateHeader('Tue 11/5', '1699171200.000000'),
      ],
    });

    // Mock conversations.replies for each date
    mockClient.conversations.replies
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', '1699084800.000000'),
          mockMessage('3:45', 'U001', '1699084900.000000'), // 225 seconds
          mockMessage('2:30', 'U002', '1699085000.000000'), // 150 seconds
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Tue 11/5', '1699171200.000000'),
          mockMessage('1:15', 'U002', '1699171300.000000'), // 75 seconds - U002's best
        ],
      });

    // Mock users.info
    mockClient.users.info
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.topTimes).toHaveLength(2);
    expect(result.topTimes[0]?.userName).toBe('Bob');
    expect(result.topTimes[0]?.totalSeconds).toBe(75);
    expect(result.topTimes[1]?.userName).toBe('Alice');
    expect(result.topTimes[1]?.totalSeconds).toBe(225);
  });

  it('tracks consecutive day streaks', async () => {
    const monday = new Date('2024-11-04T12:00:00Z');
    const tuesday = new Date('2024-11-05T12:00:00Z');
    const wednesday = new Date('2024-11-06T12:00:00Z');

    mockClient.conversations.history.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', String(monday.getTime() / 1000)),
        mockDateHeader('Tue 11/5', String(tuesday.getTime() / 1000)),
        mockDateHeader('Wed 11/6', String(wednesday.getTime() / 1000)),
      ],
    });

    // User solves on 3 consecutive days
    mockClient.conversations.replies
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Mon 11/4', String(monday.getTime() / 1000)),
          mockMessage('2:00', 'U001', String(monday.getTime() / 1000 + 100)),
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Tue 11/5', String(tuesday.getTime() / 1000)),
          mockMessage('2:10', 'U001', String(tuesday.getTime() / 1000 + 100)),
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          mockDateHeader('Wed 11/6', String(wednesday.getTime() / 1000)),
          mockMessage('2:05', 'U001', String(wednesday.getTime() / 1000 + 100)),
        ],
      });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U001', 'Alice'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.streaks).toHaveLength(1);
    expect(result.streaks[0]?.userName).toBe('Alice');
    expect(result.streaks[0]?.days).toBe(3);
  });

  it('handles no solves gracefully', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [],
    });

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.topTimes).toHaveLength(0);
    expect(result.totalSolves).toBe(0);
  });

  it('handles single solve', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('1:23', 'U001', '1699084900.000000'),
      ],
    });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U001', 'Alice'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.topTimes).toHaveLength(1);
    expect(result.topTimes[0]?.userName).toBe('Alice');
    expect(result.topTimes[0]?.totalSeconds).toBe(83);
  });

  it('ignores messages without valid times', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('Great puzzle today!', 'U001', '1699084900.000000'),
        mockMessage('1:23', 'U002', '1699085000.000000'),
        mockMessage('invalid', 'U003', '1699085100.000000'),
      ],
    });

    mockClient.users.info.mockResolvedValue(mockUserInfo('U002', 'Bob'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.topTimes).toHaveLength(1);
    expect(result.topTimes[0]?.userName).toBe('Bob');
  });

  it('limits to top 5 times', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('1:00', 'U001', '1699084900.000000'),
        mockMessage('2:00', 'U002', '1699085000.000000'),
        mockMessage('3:00', 'U003', '1699085100.000000'),
        mockMessage('4:00', 'U004', '1699085200.000000'),
        mockMessage('5:00', 'U005', '1699085300.000000'),
        mockMessage('6:00', 'U006', '1699085400.000000'),
      ],
    });

    mockClient.users.info
      .mockResolvedValueOnce(mockUserInfo('U001', 'Alice'))
      .mockResolvedValueOnce(mockUserInfo('U002', 'Bob'))
      .mockResolvedValueOnce(mockUserInfo('U003', 'Carol'))
      .mockResolvedValueOnce(mockUserInfo('U004', 'Dave'))
      .mockResolvedValueOnce(mockUserInfo('U005', 'Eve'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    expect(result.topTimes).toHaveLength(5);
    expect(result.topTimes[4]?.totalSeconds).toBe(300); // 5:00
  });

  it('handles user info fetch errors gracefully', async () => {
    mockClient.conversations.history.mockResolvedValue({
      messages: [mockDateHeader('Mon 11/4', '1699084800.000000')],
    });

    mockClient.conversations.replies.mockResolvedValue({
      messages: [
        mockDateHeader('Mon 11/4', '1699084800.000000'),
        mockMessage('1:23', 'U001', '1699084900.000000'),
      ],
    });

    // Simulate user fetch failure
    mockClient.users.info.mockRejectedValue(new Error('User not found'));

    const result = await generateLeaderboard(mockClient as any, 'C12345');

    // Solve is skipped when user info fails (caught in empty catch block)
    expect(result.topTimes).toHaveLength(0);
    expect(result.totalSolves).toBe(0);
  });
});

describe('formatLeaderboardMessage', () => {
  it('formats leaderboard with medals', () => {
    const stats = {
      topTimes: [
        {
          rank: 1,
          userName: 'Alice',
          totalSeconds: 60,
          formattedTime: '1:00',
          medal: '🥇',
        },
        {
          rank: 2,
          userName: 'Bob',
          totalSeconds: 120,
          formattedTime: '2:00',
          medal: '🥈',
        },
        {
          rank: 3,
          userName: 'Carol',
          totalSeconds: 180,
          formattedTime: '3:00',
          medal: '🥉',
        },
      ],
      streaks: [],
      totalSolves: 3,
      participantCount: 3,
    };

    const message = formatLeaderboardMessage(stats);

    expect(message).toContain("This Week's Leaderboard");
    expect(message).toContain('🥇');
    expect(message).toContain('🥈');
    expect(message).toContain('🥉');
    expect(message).toContain('Alice');
    expect(message).toContain('1:00');
  });

  it('shows streak information', () => {
    const stats = {
      topTimes: [
        {
          rank: 1,
          userName: 'Alice',
          totalSeconds: 60,
          formattedTime: '1:00',
          medal: '🥇',
        },
      ],
      streaks: [{ userName: 'Alice', days: 5 }],
      totalSolves: 5,
      participantCount: 1,
    };

    const message = formatLeaderboardMessage(stats);

    expect(message).toContain('🔥');
    expect(message).toContain('Alice');
    expect(message).toContain('5 days');
  });

  it('handles empty leaderboard', () => {
    const stats = {
      topTimes: [],
      streaks: [],
      totalSolves: 0,
      participantCount: 0,
    };

    const message = formatLeaderboardMessage(stats);

    expect(message).toContain('No solve times recorded');
  });
});
