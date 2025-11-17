// Weekly summary generation for crossword solve times

import type { WebClient } from '@slack/web-api';
import { extractSolveTimeFromMessage, formatTime } from './parser';

interface WeeklySummary {
  currentWeek: {
    totalSolves: number;
    averageTime: number;
    participantCount: number;
    fastestTime: number;
    slowestTime: number;
  };
  lastWeek: {
    totalSolves: number;
    averageTime: number;
  };
  funFacts: string[];
}

/**
 * Get solve times for a specific week
 */
async function getWeekData(client: WebClient, channelId: string, weekStart: Date, weekEnd: Date) {
  const solves: Array<{ totalSeconds: number; userId: string; userName: string }> = [];

  try {
    // Fetch all messages with pagination
    const messages = [];
    let cursor: string | undefined;

    do {
      const result = await client.conversations.history({
        channel: channelId,
        oldest: Math.floor(weekStart.getTime() / 1000).toString(),
        latest: Math.floor(weekEnd.getTime() / 1000).toString(),
        limit: 1000,
        cursor,
      });

      if (result.messages) {
        messages.push(...result.messages);
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    const dateHeaders = messages.filter(
      (msg) => msg.text && /---\s*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/.test(msg.text)
    );

    for (const header of dateHeaders) {
      if (!header.ts) continue;

      // Fetch all replies with pagination
      const allReplies = [];
      let replyCursor: string | undefined;

      do {
        const threadResult = await client.conversations.replies({
          channel: channelId,
          ts: header.ts,
          cursor: replyCursor,
          limit: 100,
        });

        if (threadResult.messages) {
          allReplies.push(...threadResult.messages);
        }

        replyCursor = threadResult.response_metadata?.next_cursor;
      } while (replyCursor);

      const replies = allReplies.slice(1);

      for (const reply of replies) {
        if (!reply.text || !reply.user) continue;

        const solveTime = extractSolveTimeFromMessage(reply.text);
        if (solveTime) {
          try {
            const userInfo = await client.users.info({ user: reply.user });
            const userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown';

            solves.push({
              totalSeconds: solveTime.totalSeconds,
              userId: reply.user,
              userName,
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
    console.error('Error fetching week data:', error);
  }

  return solves;
}

/**
 * Generate weekly summary
 */
export async function generateWeeklySummary(
  client: WebClient,
  channelId: string
): Promise<WeeklySummary> {
  const now = new Date();

  // Current week (Monday to Sunday)
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  currentMonday.setHours(0, 0, 0, 0);

  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);
  currentSunday.setHours(23, 59, 59, 999);

  // Last week
  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(currentMonday.getDate() - 7);

  const lastSunday = new Date(currentMonday);
  lastSunday.setDate(currentMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  // Fetch data
  const currentWeekData = await getWeekData(client, channelId, currentMonday, now);
  const lastWeekData = await getWeekData(client, channelId, lastMonday, lastSunday);

  // Calculate stats for current week
  const times = currentWeekData.map((s) => s.totalSeconds);
  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const participants = new Set(currentWeekData.map((s) => s.userId)).size;

  // Calculate stats for last week
  const lastWeekTimes = lastWeekData.map((s) => s.totalSeconds);
  const lastWeekAvg =
    lastWeekTimes.length > 0 ? lastWeekTimes.reduce((a, b) => a + b, 0) / lastWeekTimes.length : 0;

  // Fun facts
  const funFacts: string[] = [];

  if (times.length > 0) {
    const fastestTime = Math.min(...times);
    const fastestSolver = currentWeekData.find((s) => s.totalSeconds === fastestTime);
    if (fastestSolver) {
      funFacts.push(`Fastest solve: ${formatTime(fastestTime)} by ${fastestSolver.userName}`);
    }

    // Check for speed improvements
    if (lastWeekAvg > 0) {
      const improvement = lastWeekAvg - avgTime;
      if (improvement > 5) {
        funFacts.push(`Group is ${Math.round(improvement)}s faster than last week! 🚀`);
      } else if (improvement < -5) {
        funFacts.push(
          `Puzzles were trickier this week (+${Math.round(Math.abs(improvement))}s average)`
        );
      }
    }

    // Participation fact
    const daysThisWeek = Math.min(now.getDay() || 7, 7);
    if (participants >= daysThisWeek) {
      funFacts.push(`${participants} people have solved this week!`);
    }
  }

  return {
    currentWeek: {
      totalSolves: currentWeekData.length,
      averageTime: avgTime,
      participantCount: participants,
      fastestTime: times.length > 0 ? Math.min(...times) : 0,
      slowestTime: times.length > 0 ? Math.max(...times) : 0,
    },
    lastWeek: {
      totalSolves: lastWeekData.length,
      averageTime: lastWeekAvg,
    },
    funFacts,
  };
}

/**
 * Format weekly summary as Slack message
 */
export function formatSummaryMessage(summary: WeeklySummary): string {
  let message = '*📊 Weekly Crossword Summary*\n\n';

  if (summary.currentWeek.totalSolves === 0) {
    return `${message}_No solve times recorded this week yet._`;
  }

  message += '*This Week:*\n';
  message += `• Total solves: ${summary.currentWeek.totalSolves}\n`;
  message += `• Average time: ${formatTime(Math.round(summary.currentWeek.averageTime))}\n`;
  message += `• Participants: ${summary.currentWeek.participantCount}\n`;
  message += `• Range: ${formatTime(summary.currentWeek.fastestTime)} - ${formatTime(summary.currentWeek.slowestTime)}\n`;

  if (summary.lastWeek.totalSolves > 0) {
    message += '\n*Compared to Last Week:*\n';
    message += `• Solves: ${summary.currentWeek.totalSolves} (was ${summary.lastWeek.totalSolves})\n`;

    const avgDiff = summary.lastWeek.averageTime - summary.currentWeek.averageTime;
    const trend = avgDiff > 0 ? '⬇️ faster' : '⬆️ slower';
    message += `• Average: ${trend} by ${formatTime(Math.abs(Math.round(avgDiff)))}\n`;
  }

  if (summary.funFacts.length > 0) {
    message += '\n*Fun Facts:*\n';
    for (const fact of summary.funFacts) {
      message += `• ${fact}\n`;
    }
  }

  return message;
}
