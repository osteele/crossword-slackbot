import { WebClient } from '@slack/web-api';
import parseArgs from 'minimist';

const argv = parseArgs(process.argv.slice(2));
const isDryRun = argv['dry-run'] || false;
const lookbackDays = parseInt(argv.lookback ?? '30', 10);
const createBackDays = parseInt(argv['create-back'] ?? '7', 10);
const createForwardDays = parseInt(argv['create-forward'] ?? '7', 10);

// Validate numeric CLI arguments
function validatePositiveInt(value: number, name: string): void {
  if (Number.isNaN(value) || value < 0 || !Number.isInteger(value)) {
    console.error(
      `Error: --${name} must be a non-negative integer, got: ${argv[name] ?? 'undefined'}`
    );
    process.exit(1);
  }
}

const token = process.env.SLACK_BOT_TOKEN;
const channelName = process.env.SLACK_CHANNEL || 'crossword';

const client = token ? new WebClient(token) : undefined;

interface Message {
  text?: string;
  ts: string;
  user?: string;
}

function formatDateSeparator(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `--- ${dayName} ${month}/${day} ---`;
}

function parseExistingDateMessage(text: string): Date | null {
  const pattern = /---\s*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*(\d{1,2})\/(\d{1,2})\s*---/;
  const match = text.match(pattern);

  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const currentYear = new Date().getFullYear();

  let date = new Date(currentYear, month - 1, day);

  // Validate the date (e.g., Feb 30 becomes Mar 2)
  if (date.getMonth() !== month - 1) {
    return null;
  }

  // Handle year boundary: if parsed date is >6 months in the future,
  // assume it's from last year (e.g., parsing "Dec 28" in early January)
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  if (date > sixMonthsFromNow) {
    date = new Date(currentYear - 1, month - 1, day);
  }

  return date;
}

function _isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function _getPreviousSunday(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const dayOfWeek = result.getDay();

  if (dayOfWeek === 0) {
    result.setDate(result.getDate() - 7);
  } else {
    result.setDate(result.getDate() - dayOfWeek);
  }

  return result;
}

function getUpcomingSunday(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const dayOfWeek = result.getDay();

  if (dayOfWeek === 0) {
    // Today is Sunday, return next Sunday
    result.setDate(result.getDate() + 7);
  } else {
    // Calculate days until next Sunday
    result.setDate(result.getDate() + (7 - dayOfWeek));
  }

  return result;
}

function getDateRange(): Date[] {
  const endDate = getUpcomingSunday();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

async function findChannelId(channelName: string, slackClient?: WebClient): Promise<string | null> {
  if (!slackClient) {
    throw new Error('Slack client is required');
  }
  try {
    const targetName = channelName.replace('#', '');
    let cursor: string | undefined;

    do {
      const result = await slackClient.conversations.list({
        types: 'public_channel',
        cursor,
        limit: 200,
      });

      const channel = result.channels?.find((ch) => ch.name === targetName);
      if (channel?.id) {
        return channel.id;
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return null;
  } catch (error) {
    console.error('Error finding channel:', error);
    return null;
  }
}

async function getChannelMessages(
  channelId: string,
  oneWeekAgo: Date,
  slackClient?: WebClient
): Promise<Message[]> {
  if (!slackClient) {
    throw new Error('Slack client is required');
  }
  const messages: Message[] = [];
  let cursor: string | undefined;
  const oldest = Math.floor(oneWeekAgo.getTime() / 1000).toString();

  try {
    do {
      const result = await slackClient.conversations.history({
        channel: channelId,
        oldest,
        cursor,
        limit: 200,
      });

      if (result.messages) {
        messages.push(...(result.messages as Message[]));
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

async function findMostRecentDateHeader(
  channelId: string,
  lookbackDays: number,
  slackClient?: WebClient
): Promise<Date | null> {
  if (!slackClient) {
    throw new Error('Slack client is required');
  }
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

  const messages = await getChannelMessages(channelId, lookbackDate, slackClient);

  let mostRecentDate: Date | null = null;
  for (const message of messages) {
    if (message.text) {
      const date = parseExistingDateMessage(message.text);
      if (date && (!mostRecentDate || date > mostRecentDate)) {
        mostRecentDate = date;
      }
    }
  }

  return mostRecentDate;
}

async function postDateSeparator(
  channelId: string,
  date: Date,
  dryRun: boolean,
  slackClient?: WebClient
): Promise<void> {
  if (!slackClient && !dryRun) {
    throw new Error('Slack client is required when not in dry-run mode');
  }
  const text = formatDateSeparator(date);

  if (dryRun) {
    console.log(`[DRY RUN] Would post: ${text}`);
    return;
  }

  try {
    await slackClient.chat.postMessage({
      channel: channelId,
      text,
    });
    console.log(`Posted: ${text}`);
  } catch (error) {
    console.error(`Error posting message for ${date.toDateString()}:`, error);
  }
}

async function addMissingDateSeparators(): Promise<void> {
  if (!client) {
    throw new Error('Slack client is not initialized');
  }

  if (isDryRun) {
    console.log('=== DRY RUN MODE ===');
    console.log('No messages will be posted to Slack\n');
  }

  const channelId = await findChannelId(channelName, client);

  if (!channelId) {
    console.error(`Channel '${channelName}' not found`);
    return;
  }

  console.log(`Found channel: ${channelName} (${channelId})`);
  console.log(
    `CLI options: lookback=${lookbackDays}, create-back=${createBackDays}, create-forward=${createForwardDays}`
  );

  // Find the most recent date header
  const mostRecentHeader = await findMostRecentDateHeader(channelId, lookbackDays, client);

  // Calculate the date range based on CLI arguments
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = new Date(today);
  startDate.setDate(startDate.getDate() - createBackDays);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + createForwardDays);

  // If we found a recent header, start from the day after it (to avoid backfilling)
  if (mostRecentHeader) {
    console.log(`Most recent date header found: ${formatDateSeparator(mostRecentHeader)}`);

    // Only adjust start date if the most recent header is within our intended range
    if (mostRecentHeader >= startDate && mostRecentHeader < endDate) {
      const dayAfterMostRecent = new Date(mostRecentHeader);
      dayAfterMostRecent.setDate(dayAfterMostRecent.getDate() + 1);
      startDate = dayAfterMostRecent;
      console.log(
        `Adjusting start date to avoid backfilling: starting from ${formatDateSeparator(startDate)}`
      );
    }
  } else {
    console.log(`No recent date headers found in the past ${lookbackDays} days`);
  }

  // Generate all dates in the range
  const dateRange: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(
    `Checking dates from ${startDate.toDateString()} to ${endDate.toDateString()} (${dateRange.length} days)`
  );

  const messages = await getChannelMessages(channelId, startDate, client);
  console.log(`Found ${messages.length} messages in date range`);

  const existingDates = new Set<string>();
  for (const message of messages) {
    if (message.text) {
      const date = parseExistingDateMessage(message.text);
      if (date) {
        existingDates.add(date.toDateString());
      }
    }
  }

  console.log(`Found ${existingDates.size} existing date separators in range`);

  const missingDates: Date[] = [];
  const datesWithHeaders: Date[] = [];

  for (const date of dateRange) {
    if (existingDates.has(date.toDateString())) {
      datesWithHeaders.push(date);
    } else {
      missingDates.push(date);
    }
  }

  if (datesWithHeaders.length > 0) {
    console.log(`\nDates with existing headers (skipping):`);
    for (const date of datesWithHeaders) {
      console.log(`  ✓ ${formatDateSeparator(date)}`);
    }
  }

  if (missingDates.length === 0) {
    console.log('\nNo missing date separators found');
    return;
  }

  console.log(`\nDates missing headers (${isDryRun ? 'would post' : 'posting'}):`);
  for (const date of missingDates) {
    console.log(`  → ${formatDateSeparator(date)}`);
  }

  console.log(
    `\n${isDryRun ? 'Would add' : 'Adding'} ${missingDates.length} missing date separators...`
  );

  for (const date of missingDates) {
    await postDateSeparator(channelId, date, isDryRun, client);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\nDone!');
}

// Only run if not imported as a module
if (import.meta.main) {
  // Validate CLI arguments
  validatePositiveInt(lookbackDays, 'lookback');
  validatePositiveInt(createBackDays, 'create-back');
  validatePositiveInt(createForwardDays, 'create-forward');

  if (argv.help || argv.h) {
    console.log(`
Usage: bun run index.ts [options]

Options:
  --dry-run              Don't post messages, just show what would be posted
  --lookback <days>      How many days back to search for the most recent date header (default: 30)
  --create-back <days>   How many days back from today to create headers (default: 7)
  --create-forward <days> How many days forward from today to create headers (default: 7)
  --help, -h             Show this help message

Examples:
  bun run index.ts --dry-run
  bun run index.ts --create-back 14 --create-forward 0
  bun run index.ts --lookback 60 --create-back 30 --create-forward 1
`);
    process.exit(0);
  }

  if (!token) {
    console.error('SLACK_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  addMissingDateSeparators().catch(console.error);
}

// Export functions for testing
export {
  formatDateSeparator,
  parseExistingDateMessage,
  _isSameDay as isSameDay,
  _getPreviousSunday as getPreviousSunday,
  getUpcomingSunday,
  getDateRange,
  findChannelId,
  getChannelMessages,
  findMostRecentDateHeader,
  postDateSeparator,
};
