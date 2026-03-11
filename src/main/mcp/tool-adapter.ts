import { AggregatedTool } from './mcp-manager'
import { ToolDefinition } from '../providers/base-provider'

/**
 * Converts aggregated MCP tools to the provider-neutral ToolDefinition format.
 * Provider-specific formatting is done in each provider's formatTools() method.
 */
export function mcpToolsToProviderTools(mcpTools: AggregatedTool[]): ToolDefinition[] {
  return mcpTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
}
