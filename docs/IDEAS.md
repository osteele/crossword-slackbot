# Future Ideas & Enhancements

## Private Channel Support

### Current Limitation
The bot currently only supports **public channels** due to the configured Slack API scopes:
- `channels:history` - View messages in public channels
- `channels:read` - View basic channel info
- `chat:write` - Send messages

### Adding Private Channel Support

To make the bot work with private channels, you would need to:

#### 1. Update Slack App Scopes
Add the following scopes in your Slack app configuration (https://api.slack.com/apps → Your App → OAuth & Permissions):
- `groups:history` - View messages in private channels
- `groups:read` - View basic private channel info

#### 2. Update Channel Discovery Code
Modify `findChannelId()` in `index.ts` to include private channels:

```typescript
const result = await client.conversations.list({
  types: 'public_channel,private_channel',  // Add private_channel
  cursor,
  limit: 200,
});
```

#### 3. Reinstall the App
After adding new scopes, users must reinstall the app to grant the additional permissions:
1. Go to your Slack app settings
2. Click "Reinstall App"
3. Review and approve the new permissions

#### 4. Update Documentation
Update README.md to remove the "public channels only" limitation and explain:
- The additional scopes required
- That users need to reinstall the app
- How to add the bot to private channels

### Trade-offs

**Pros:**
- Works with private crossword channels (common in many workspaces)
- More flexible deployment

**Cons:**
- Requires broader permissions (some security-conscious orgs may object)
- All existing users need to reinstall the app
- Slightly more complex permission model

### Implementation Effort
Low - mainly scope changes and documentation updates. The code already handles pagination correctly after recent fixes.

---

## Other Enhancement Ideas

### Multi-Channel Support
Support multiple crossword channels (e.g., `#crossword-mini`, `#crossword-weekly`)
- Accept comma-separated channel names in `SLACK_CHANNEL` env var
- Run bot against each channel sequentially

### Customizable Date Format
Allow configuration of date separator format:
- Environment variable like `DATE_FORMAT="--- {day} {month}/{date} ---"`
- Support different separator styles

### Slack Slash Command Integration
Add a `/crossword-bot` slash command to:
- Manually trigger header creation
- Check bot status
- Show upcoming headers

### Notification Mode
Optionally DM team members when new headers are posted:
- Remind people to post their times
- Configurable via `ENABLE_NOTIFICATIONS` env var

---

## Interactive Bot Features

When mentioned (`@bot`), the bot can respond with helpful and fun features:

### ✅ Implemented Features

#### Leaderboard
**Command:** `@bot leaderboard`

Shows:
- Top 5 fastest times this week with 🥇🥈🥉
- Streak tracking (consecutive days)
- Personal bests
- Formatted beautifully with Slack blocks

**Status:** ✅ Implemented - Interactive
**Files:** `src/leaderboard.ts`, `src/parser.ts`
**Usage:** Mention the bot with `@bot leaderboard` in Slack, or test with `bun run index.ts --test-leaderboard`
**Bot Mode:** Run with `bun run bot.ts` to enable @mention handling

#### Weekly Summary
**Command:** `@bot summary` or `@bot report`

Shows:
- Total solves this week
- Average time trending (vs last week)
- Participation rate
- Fun statistics

**Status:** ✅ Implemented - Interactive
**Files:** `src/summary.ts`, `src/parser.ts`
**Usage:** Mention the bot with `@bot summary` or `@bot report` in Slack, or test with `bun run index.ts --test-summary`
**Bot Mode:** Run with `bun run bot.ts` to enable @mention handling

---

### 🚀 Future Interactive Features

#### Streaks & Achievements
**Priority:** High | **Fun:** 8/10 | **Usefulness:** 8/10

Bot celebrates milestones automatically:
- "🔥 7-day streak! @alice is on fire!"
- Unlock badges:
  - "Speed Demon" (solve time < 30 seconds)
  - "Dedicated" (30-day streak)
  - "Night Owl" (latest solve time of the day)
- `@bot stats` for personal achievement summary

**Implementation:** Requires state persistence, listen to message events

#### Time Range Insights
**Priority:** High | **Fun:** 7/10 | **Usefulness:** 8/10

Answer questions:
- `@bot when` → average solve time by day of week
- `@bot compare @alice @bob` → head-to-head comparison
- `@bot fastest` → best personal records this month

#### Crossword Fun Facts & Trivia
**Priority:** Medium | **Fun:** 8/10 | **Usefulness:** 6/10

Commands:
- `@bot fact` → Random crossword trivia
- `@bot motivate` → Encouraging messages
- `@bot joke` → Crossword-themed puns

Example facts:
- "The first crossword puzzle was published in 1913"
- "Will Shortz has been the NYT crossword editor since 1993"
- "A 'natick' is when two obscure answers cross at an obscure letter"

#### Solve Time Reactions (Reacji)
**Priority:** Medium | **Fun:** 6/10 | **Usefulness:** 7/10

Auto-react to posted times:
- ⚡ for times under 30 seconds
- 🔥 for new personal records
- 🎉 for milestone times

#### Personal Trend Analysis
**Priority:** High | **Fun:** 6/10 | **Usefulness:** 9/10

**Command:** `@bot my-trend`

Shows:
- Average solve time over time
- Getting faster/slower?
- Best time this month
- ASCII sparkline: `▁▂▃▄▅▆▇█`

#### ASCII Distribution Graph
**Priority:** Low | **Fun:** 6/10 | **Usefulness:** 7/10

**Command:** `@bot graph`

Shows histogram:
```
Under 30s:     ████ 4
30s - 1 min:   ████████████ 12
1-3 min:       ██████████████████ 18
```

#### Format Coaching
**Priority:** Low | **Fun:** 5/10 | **Usefulness:** 8/10

Gently suggest correct time format when malformed entries detected

#### "Guess the Solver" Game
**Priority:** Low | **Fun:** 8/10 | **Usefulness:** 4/10

Weekly game: guess who posted an anonymized time

---

### Technical Notes

**Fast Time Threshold:** < 30 seconds (not < 5 minutes)

**Time Formats to Parse:**
- `3:45` (3 minutes 45 seconds)
- `0:47` (47 seconds)
- `:23` or `23` (23 seconds)
