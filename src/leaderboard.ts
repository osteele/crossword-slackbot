// Leaderboard generation for crossword solve times

import type { WebClient } from '@slack/web-api';
import { extractSolveTimeFromMessage, formatTime, type SolveTime } from './parser';

interface UserSolve {
  userId: string;
  userName: string;
  time: SolveTime;
  date: Date;
}

interface LeaderboardEntry {
  rank: number;
  userName: string;
  totalSeconds: number;
  formattedTime: string;
  medal?: string;
}

interface WeekStats {
  topTimes: LeaderboardEntry[];
  streaks: Array<{ userName: string; days: number }>;
  totalSolves: number;
  participantCount: number;
}

/**
 * Get all solve times from the current week
 */
async function getWeekSolves(client: WebClient, channelId: string): Promise<UserSolve[]> {
  const solves: UserSolve[] = [];
  const now = new Date();

  // Get Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);

  try {
    // Fetch messages from Monday onwards
    const result = await client.conversations.history({
      channel: channelId,
      oldest: Math.floor(monday.getTime() / 1000).toString(),
      limit: 1000,
    });

    const messages = result.messages || [];

    // Find date header messages
    const dateHeaders = messages.filter(
      (msg) => msg.text && /---\s*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/.test(msg.text)
    );

    // For each date header, fetch thread replies to get solve times
    for (const header of dateHeaders) {
      if (!header.ts) continue;

      const threadResult = await client.conversations.replies({
        channel: channelId,
        ts: header.ts,
      });

      const replies = (threadResult.messages || []).slice(1); // Skip the header itself

      for (const reply of replies) {
        if (!reply.text || !reply.user) continue;

        const solveTime = extractSolveTimeFromMessage(reply.text);
        if (solveTime) {
          // Get user info
          try {
            const userInfo = await client.users.info({ user: reply.user });
            const userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown';

            solves.push({
              userId: reply.user,
              userName,
              time: { ...solveTime, userId: reply.user, timestamp: reply.ts },
              date: new Date(Number.parseFloat(reply.ts || '0') * 1000),
            });
          } catch (err) {
            console.error(
              `Error fetching user info: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching week solves:', error);
  }

  return solves;
}

/**
 * Generate leaderboard from solve times
 */
export async function generateLeaderboard(
  client: WebClient,
  channelId: string
): Promise<WeekStats> {
  const solves = await getWeekSolves(client, channelId);

  // Find top times (best single solve per user)
  const userBestTimes = new Map<string, UserSolve>();

  for (const solve of solves) {
    const existing = userBestTimes.get(solve.userId);
    if (!existing || solve.time.totalSeconds < existing.time.totalSeconds) {
      userBestTimes.set(solve.userId, solve);
    }
  }

  // Sort by time and create leaderboard
  const sorted = Array.from(userBestTimes.values()).sort(
    (a, b) => a.time.totalSeconds - b.time.totalSeconds
  );

  const medals = ['🥇', '🥈', '🥉'];
  const topTimes: LeaderboardEntry[] = sorted.slice(0, 5).map((solve, idx) => ({
    rank: idx + 1,
    userName: solve.userName,
    totalSeconds: solve.time.totalSeconds,
    formattedTime: formatTime(solve.time.totalSeconds),
    medal: idx < 3 ? medals[idx] : undefined,
  }));

  // Calculate streaks (simplified - just count unique days per user)
  const userDays = new Map<string, Set<string>>();
  for (const solve of solves) {
    const dateKey = solve.date.toDateString();
    if (!userDays.has(solve.userId)) {
      userDays.set(solve.userId, new Set());
    }
    userDays.get(solve.userId)?.add(dateKey);
  }

  const streaks = Array.from(userDays.entries())
    .map(([userId, days]) => {
      const userName = solves.find((s) => s.userId === userId)?.userName || 'Unknown';
      return { userName, days: days.size };
    })
    .filter((s) => s.days >= 3) // Only show streaks of 3+ days
    .sort((a, b) => b.days - a.days);

  return {
    topTimes,
    streaks,
    totalSolves: solves.length,
    participantCount: userBestTimes.size,
  };
}

/**
 * Format leaderboard as Slack message
 */
export function formatLeaderboardMessage(stats: WeekStats): string {
  let message = "*🏆 This Week's Leaderboard*\n\n";

  if (stats.topTimes.length === 0) {
    return `${message}_No solve times recorded this week yet._`;
  }

  message += '*Top Times:*\n';
  for (const entry of stats.topTimes) {
    const medal = entry.medal || `${entry.rank}.`;
    message += `${medal} *${entry.userName}* — ${entry.formattedTime}\n`;
  }

  if (stats.streaks.length > 0) {
    message += '\n*🔥 Streaks:*\n';
    for (const streak of stats.streaks) {
      message += `• ${streak.userName}: ${streak.days} days\n`;
    }
  }

  message += `\n_${stats.totalSolves} total solves from ${stats.participantCount} solver${stats.participantCount === 1 ? '' : 's'}_`;

  return message;
}
