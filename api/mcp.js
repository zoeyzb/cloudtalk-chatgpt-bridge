const CLOUDTALK_BASE = "https://api.cloudtalk.io";
const PRIVATE_MCP_PATH = "/api/mcp-hqyCRMC_axNWmv2mXh30zY0JYJZ3LTX2";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization, mcp-session-id");
  res.setHeader("access-control-expose-headers", "mcp-session-id");
  res.end(JSON.stringify(body));
}

function cloudTalkAuth() {
  const id = process.env.CLOUDTALK_API_KEY_ID;
  const secret = process.env.CLOUDTALK_API_KEY_SECRET;
  if (!id || !secret) throw new Error("CloudTalk credentials are not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function cloudTalkRequest(method, path, body) {
  if (!path.startsWith("/v1/voice-agent/")) {
    throw new Error("Only /v1/voice-agent/* CloudTalk paths are allowed");
  }
  if (!["GET", "POST", "PATCH", "PUT"].includes(method)) {
    throw new Error("Method not allowed");
  }

  const response = await fetch(CLOUDTALK_BASE + path, {
    method,
    headers: {
      authorization: cloudTalkAuth(),
      "content-type": "application/json"
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {})
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch { data = { raw }; }

  return { ok: response.ok, status: response.status, data };
}

const tools = [
  {
    name: "bridge_status",
    description: "Check whether the private CloudTalk bridge is online and whether CloudTalk credentials are configured. Never exposes secrets.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true }
  },
  {
    name: "start_voiceagent_call",
    description: "Start one outbound CloudTalk VoiceAgent call. Use only when the user explicitly asks to place or test a call. Use E.164 format such as +13125551234.",
    inputSchema: {
      type: "object",
      properties: {
        call_number: { type: "string" },
        voice_agent_id: { type: "string" },
        variables: {
          type: "object",
          additionalProperties: true,
          description: "Optional per-call context such as business_name, preview_url, website_status."
        }
      },
      required: ["call_number", "voice_agent_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: "voiceagent_api_request",
    description: "Read or update a CloudTalk VoiceAgent API endpoint under /v1/voice-agent/. Use GET for reads; use POST, PATCH, or PUT only when the user asks for a change.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", enum: ["GET", "POST", "PATCH", "PUT"] },
        path: { type: "string", description: "CloudTalk path beginning with /v1/voice-agent/" },
        body: { type: "object", additionalProperties: true }
      },
      required: ["method", "path"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  }
];

async function runTool(name, args) {
  if (name === "bridge_status") {
    return {
      bridge: "ok",
      cloudtalk_credentials_configured: Boolean(
        process.env.CLOUDTALK_API_KEY_ID &&
        process.env.CLOUDTALK_API_KEY_SECRET
      )
    };
  }

  if (name === "start_voiceagent_call") {
    const payload = {
      call_number: args.call_number,
      voice_agent_id: args.voice_agent_id
    };

    if (args.variables && Object.keys(args.variables).length > 0) {
      payload.call_properties = { system_prompt: args.variables };
    }

    return cloudTalkRequest("POST", "/v1/voice-agent/calls", payload);
  }

  if (name === "voiceagent_api_request") {
    return cloudTalkRequest(args.method, args.path, args.body);
  }

  throw new Error("Unknown tool");
}

export default async function handler(req, res) {
  const pathname = new URL(req.url, "https://bridge.local").pathname;
  if (pathname !== PRIVATE_MCP_PATH) {
    return sendJson(res, 404, { error: "not_found" });
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type, authorization, mcp-session-id");
    res.setHeader("access-control-expose-headers", "mcp-session-id");
    return res.end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "cloudtalk-chatgpt-bridge",
      cloudtalk_credentials_configured: Boolean(
        process.env.CLOUDTALK_API_KEY_ID &&
        process.env.CLOUDTALK_API_KEY_SECRET
      )
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const body =
    typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});
  const id = body.id ?? null;

  try {
    if (body.method === "initialize") {
      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "cloudtalk-chatgpt-bridge", version: "1.1.0" }
        }
      });
    }

    if (body.method === "notifications/initialized") {
      res.statusCode = 204;
      return res.end();
    }

    if (body.method === "ping") {
      return sendJson(res, 200, { jsonrpc: "2.0", id, result: {} });
    }

    if (body.method === "tools/list") {
      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { tools }
      });
    }

    if (body.method === "tools/call") {
      const result = await runTool(
        body.params?.name,
        body.params?.arguments || {}
      );

      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result
        }
      });
    }

    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" }
    });
  } catch (error) {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message || "Bridge error" }
    });
  }
}
