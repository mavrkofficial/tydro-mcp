#!/usr/bin/env node
/**
 * Tydro MCP Server — HTTP/SSE Transport
 *
 * Exposes the same tools as the stdio server but over HTTP with SSE streaming.
 * Use this for agent-to-agent usage (e.g. OpenClaw agents on Railway) where
 * stdio is not available.
 *
 * Usage:
 *   TYDRO_NETWORK=mainnet PRIVATE_KEY=0x... PORT=3100 node build/http.js
 *
 * Then configure your OpenClaw agent to connect to:
 *   http://localhost:3100/sse  (SSE endpoint)
 *   http://localhost:3100/message  (POST endpoint)
 */
export {};
