# Crossword Slackbot

![GitHub Actions](https://github.com/osteele/crossword-slackbot/actions/workflows/crossword-bot.yml/badge.svg)
![Bun](https://img.shields.io/badge/bun-latest-black?logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

<img src="docs/mascot.heic" alt="Crossword Slackbot mascot" width="150" align="right">

A Slackbot that automatically adds date header messages to the #crossword channel. The bot looks back one week and adds messages like "--- Mon 9/29 ---" for each day where nobody has posted their crossword time, ending on the previous Sunday.

## Why?

In our #crossword channel, we have a convention of posting our daily crossword completion times. Each day needs a date header message that people reply to with their times. This bot ensures there's always a date header for each day of the past week, so people can post their times even if they're catching up from earlier in the week.

## Example

Here's what the channel looks like with the bot's date headers:

```
kermit   10:45 AM
--- Thu 9/11 ---

hobbes   11:20 AM
0:38

totoro   2:15 PM
1:25

pooh     6:30 PM
0:24

kermit   10:46 AM
--- Fri 9/12 ---

totoro   1:05 PM
0:52

kermit   10:47 AM
--- Sat 9/13 ---

hobbes   11:30 AM
1:15
```

People post their completion times as replies to each day's header message.

## Features

- Checks the past week (up to the previous Sunday) for missing date headers
- Detects existing date messages even with varying whitespace
- Posts missing date headers in chronological order
- Skips days that already have date header messages

## Setup

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "Crossword Date Bot") and select your workspace
4. Fill in the Display Information:
   - **Short description:** `Automatically posts daily date headers for crossword time tracking`
   - **Long description:** `Keep your crossword channel organized with automatic date headers. This bot checks the past week and posts date header messages (like "--- Mon 9/29 ---") for any days that are missing them.`
   - **Background color:** `#121212` (matches the NY Times crossword app's dark theme with black squares)
5. Navigate to "OAuth & Permissions" in the sidebar
6. Add the following Bot Token Scopes:
   - `channels:history` - View messages in public channels
   - `channels:read` - View basic channel info
   - `chat:write` - Send messages
7. Install the app to your workspace
8. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 2. Add the Bot to the Channel

In Slack, add the bot to your #crossword channel:
1. Type `/add` in the channel
2. Choose the app "Crossword Date Bot" (or whatever you named your app) from the UI

### 3. Configure Environment Variables

Copy the example environment file and add your token:

```bash
cp .env.example .env
```

Edit `.env` and add your Slack bot token:
```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNEL=crossword
```

### 4. Install Dependencies

```bash
bun install
```

## Usage

Run the bot manually:

```bash
bun run index.ts
```

By default, the bot will create date headers for the past 7 days and the next 7 days.

### CLI Options

```bash
bun run index.ts [options]

Options:
  --dry-run              Don't post messages, just show what would be posted
  --lookback <days>      How many days back to search for the most recent date header (default: 30)
  --create-back <days>   How many days back from today to create headers (default: 7)
  --create-forward <days> How many days forward from today to create headers (default: 7)
  --help, -h             Show help message

Examples:
  # Preview what would be posted without actually posting
  bun run index.ts --dry-run

  # Only create headers for the past 2 weeks, no future dates
  bun run index.ts --create-back 14 --create-forward 0

  # Create tomorrow's header only (useful for daily cron jobs)
  bun run index.ts --create-back 0 --create-forward 1

  # Look back 60 days for the most recent header, create past month + next week
  bun run index.ts --lookback 60 --create-back 30 --create-forward 7
```

The bot will:
1. Find the #crossword channel
2. Search for the most recent date header (within the lookback period)
3. Fetch messages in the specified date range
4. Identify which dates are missing header messages
5. Post header messages for missing dates in chronological order

### Scheduling

To run the bot automatically, you have several options:

#### Option 1: GitHub Actions (Recommended)

The easiest way to run the bot on a schedule without managing any infrastructure:

1. **Set up secrets** in your GitHub repository:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `SLACK_BOT_TOKEN` with your bot token (starts with `xoxb-`)
   - Add `SLACK_CHANNEL` with your channel name (e.g., `crossword`)

2. **Push the workflow file** (already included):
   - The workflow file at `.github/workflows/crossword-bot.yml` is configured to run daily
   - By default, it runs at midnight UTC and creates tomorrow's date header (`--create-back 0 --create-forward 1`)
   - Adjust the cron schedule and CLI options if needed

3. **Test the workflow**:
   - Go to Actions tab in your GitHub repository
   - Select "Crossword Date Separator Bot" workflow
   - Click "Run workflow" to test manually
   - Check the logs to verify it worked

4. **Monitor execution**:
   - View execution history in the Actions tab
   - Check logs for any errors
   - GitHub will email you if the workflow fails

**Customizing the workflow:**

Edit `.github/workflows/crossword-bot.yml` to adjust:

1. **Schedule** (cron expression):
```yaml
schedule:
  - cron: '0 0 * * *'    # Midnight UTC daily
  - cron: '0 1 * * 0'    # 1 AM UTC every Sunday
  - cron: '30 23 * * *'  # 11:30 PM UTC daily
```

2. **CLI arguments** (in the "Run crossword bot" step):
```yaml
run: bun run index.ts --create-back 0 --create-forward 1  # Default: tomorrow only
run: bun run index.ts --create-back 7 --create-forward 7  # Past week + next week
run: bun run index.ts --create-back 0 --create-forward 7  # Next week only
```

#### Option 2: Local Cron Job

If you have a computer that's always running:

**On macOS/Linux (crontab):**

```bash
# Edit your crontab
crontab -e

# Run daily at midnight to create tomorrow's header
0 0 * * * cd /path/to/crossword-slackbot && /usr/local/bin/bun run index.ts --create-back 0 --create-forward 1 >> /tmp/crossword-bot.log 2>&1

# Or run every Sunday at 11:59 PM to create the next week
59 23 * * 0 cd /path/to/crossword-slackbot && /usr/local/bin/bun run index.ts --create-back 0 --create-forward 7 >> /tmp/crossword-bot.log 2>&1
```

#### Option 3: Cloud Hosting

Other cloud options if you prefer:

- **AWS Lambda + EventBridge**: Serverless function with scheduled triggers
- **Railway**: Cron jobs with simple deployment
- **Render**: Free tier includes cron jobs
- **Google Cloud Scheduler + Cloud Run**: Similar to AWS option

For most users, **GitHub Actions is recommended** because it's free, reliable, and requires no infrastructure management.

## Date Format

The bot posts date header messages in this format:
```
--- Mon 9/29 ---
```

The format is flexible with whitespace when parsing existing messages, so variations like `---Mon 9/29---` or `--- Mon 9/29---` will be recognized and skipped.

## How It Works

1. **Date Range**: Calculates the date range from one week ago to the previous Sunday
2. **Message Fetching**: Retrieves all messages in that date range from the channel
3. **Date Detection**: Parses existing messages to find date headers using regex
4. **Gap Detection**: Identifies which dates are missing headers
5. **Posting**: Posts missing date headers in chronological order with 1-second delays

## Development

The project uses:
- [Bun](https://bun.sh) - JavaScript runtime and package manager
- [@slack/web-api](https://www.npmjs.com/package/@slack/web-api) - Slack Web API client
- [@slack/bolt](https://www.npmjs.com/package/@slack/bolt) - Slack app framework
- TypeScript for type safety

## License

MIT
