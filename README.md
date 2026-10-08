# CloudTalk ChatGPT Bridge

Private MCP bridge between ChatGPT and the CloudTalk VoiceAgent API.

## Required Vercel environment variables

- `CLOUDTALK_API_KEY_ID`
- `CLOUDTALK_API_KEY_SECRET`
- `BRIDGE_TOKEN`

Never commit those secrets to GitHub.

## Endpoint

`/api/mcp`

The endpoint supports:
- `bridge_status`
- `start_voiceagent_call`
- `voiceagent_api_request`

Deployment trigger: CloudTalk credentials configured on Vercel.
