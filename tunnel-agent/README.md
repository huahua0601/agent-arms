# AgentHub Tunnel Agent

Reverse tunnel for MCP servers in private networks — like ngrok but MCP-native.

## Use case

Your MCP server runs inside a private subnet (VPC, office LAN, home network). It can
reach the public internet (outbound) but cannot receive inbound connections. You want
Cursor / Claude / any MCP client running anywhere to call this server via a public
AgentHub registry.

## How it works

```
Public Registry (AgentHub)
       ▲
       │ WebSocket (outbound from agent)
       │
  Tunnel Agent (this script, runs inside your private network)
       │
       ▼ HTTP (local)
  Your MCP Server (http://localhost:8080)
```

1. Register your server in the AgentHub UI and click "Enable Tunnel" to generate a token.
2. Run this agent inside your private network with that token.
3. The agent opens a persistent WebSocket to the registry. No inbound firewall rule needed.
4. When a client calls your server via the registry's Gateway, the registry forwards
   the JSON-RPC request through the WebSocket. The agent calls the local MCP server
   and returns the response.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
python agent.py \
  --registry https://registry.example.com \
  --token tnl_xxxxxxxxxxxxxxxxxx \
  --local http://localhost:8080/mcp
```

Optional auth forwarding to the local MCP server:

```bash
python agent.py \
  --registry https://registry.example.com \
  --token tnl_xxx \
  --local http://localhost:8080/mcp \
  --auth-header "X-API-Key" \
  --auth-value "my-local-api-key"
```

## Options

| Flag            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `--registry`    | Public registry URL (http or https)                  |
| `--token`       | Tunnel token from the registry UI                    |
| `--local`       | Local MCP server endpoint                            |
| `--auth-header` | Optional auth header to inject into local calls      |
| `--auth-value`  | Value for the auth header                            |
| `--name`        | Display name shown in the registry (default: hostname)|
| `--verbose`     | Verbose logging                                      |

## Auto-reconnect

The agent automatically reconnects with exponential backoff on network errors
(up to 30s between attempts). It sends a ping every 30 seconds to keep the
connection alive.

## Security notes

- The tunnel token is hashed with SHA-256 on the registry side — only the token
  prefix is stored visibly. If lost, create a new one.
- The local MCP server is never exposed directly; all requests go through the
  registry and are authenticated + audited there.
