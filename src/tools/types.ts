import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type {
  ZodRawShapeCompat,
  ShapeOutput,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';

export type McpTool = {
  name: string;
  description: string;
  inputSchema: ZodRawShapeCompat;
  annotations?: ToolAnnotations;
  handler: ToolCallback<ZodRawShapeCompat>;
};

export function defineTool<Args extends ZodRawShapeCompat>(tool: {
  name: string;
  description: string;
  inputSchema: Args;
  annotations?: ToolAnnotations;
  handler: (
    args: ShapeOutput<Args>,
    extra: Parameters<ToolCallback<Args>>[1],
  ) => CallToolResult | Promise<CallToolResult>;
}): McpTool {
  return tool as McpTool;
}
