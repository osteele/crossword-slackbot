// Interactive Slack bot with event handling

import { App } from '@slack/bolt';
import { formatLeaderboardMessage, generateLeaderboard } from './src/leaderboard';
import { formatSummaryMessage, generateWeeklySummary } from './src/summary';

const token = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;
const channelName = process.env.SLACK_CHANNEL || 'crossword';

if (!token || !signingSecret) {
  console.error('SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET environment variables are required');
  process.exit(1);
}

const app = new App({
  token,
  signingSecret,
});

/**
 * Find channel ID by name
 */
async function findChannelId(channelNameToFind: string): Promise<string | null> {
  try {
    const result = await app.client.conversations.list({
      types: 'public_channel',
    });

    const channel = result.channels?.find((ch) => ch.name === channelNameToFind.replace('#', ''));

    return channel?.id || null;
  } catch (error) {
    console.error('Error finding channel:', error);
    return null;
  }
}

/**
 * Handle app mentions
 */
app.event('app_mention', async ({ event, say }) => {
  const text = event.text.toLowerCase();

  try {
    // Get channel ID
    const channelId = event.channel;

    if (text.includes('leaderboard')) {
      console.log('Generating leaderboard...');
      const stats = await generateLeaderboard(app.client, channelId);
      const message = formatLeaderboardMessage(stats);
      await say({
        text: message,
        thread_ts: event.ts,
      });
    } else if (text.includes('summary') || text.includes('report')) {
      console.log('Generating weekly summary...');
      const summary = await generateWeeklySummary(app.client, channelId);
      const message = formatSummaryMessage(summary);
      await say({
        text: message,
        thread_ts: event.ts,
      });
    } else if (text.includes('help')) {
      await say({
        text: `Hi! I can help with crossword stats. Try:\n• \`@bot leaderboard\` - Show this week's top times\n• \`@bot summary\` - Weekly summary report`,
        thread_ts: event.ts,
      });
    } else {
      await say({
        text: `Not sure what you're asking for. Try \`@bot help\` for available commands.`,
        thread_ts: event.ts,
      });
    }
  } catch (error) {
    console.error('Error handling mention:', error);
    await say({
      text: 'Sorry, something went wrong processing your request.',
      thread_ts: event.ts,
    });
  }
});

/**
 * Start the bot
 */
async function start() {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  await app.start(port);
  console.log(`⚡️ Crossword Bot is running on port ${port}`);
  console.log(`Monitoring channel: #${channelName}`);
  console.log('Listening for mentions...');
}

// Only start if running directly (not imported)
if (import.meta.main) {
  start().catch(console.error);
}

export { app, findChannelId };
