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
