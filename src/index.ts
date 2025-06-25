import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { launchServer, TransportType } from "@trc-sdlc-huawei/tehila-mcp-openapi";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});


	async init() {
		this.server = await launchServer(
			TransportType.STDIO,
			{
				tools: [
					// Simple tool with Zod schema: [name, schema, handler]
					[
						"calculate-bmi",
						// Define schema using Zod
						{
							weightKg: z.number(),
							heightM: z.number(),
						},
						async ({ weightKg, heightM }: { weightKg: number; heightM: number }) => ({
							content: [
								{
									type: "text",
									text: String(weightKg / (heightM * heightM)),
								},
							],
						}),
					],
					// Tool with more complex Zod schema: [name, schema, handler]
					[
						"fetch-weather",
						{ city: z.string() },
						async ({ city }: { city: string }) => {
							const response = await fetch(`https://api.weather.com/${city}`);
							const data = await response.text();
							return {
								content: [{ type: "text", text: data }],
							};
						},
					],
				],
				resources: [
					// Static resource: [name, uriPattern, handler]
					[
						"entities",
						"entities://environment",
						async (uri: any) => ({
							contents: [
								{
									uri: uri.href,
									text: "App configuration here",
								},
							],
						}),
					],

					// Dynamic resource with parameters: [name, uriTemplate, handler]
					[
						"user-profile",
						"users://{userId}/profile",
						async (uri: any) => {
							const userId = uri.pathname.split("/")[1];
							return {
								contents: [
									{
										uri: uri.href,
										text: `Profile data for user ${userId}`,
									},
								],
							};
						},
					],
				],
				apiOptions: {
					headers: {
						// You can add default headers here
						"x-language": "en-us",
					},
				}
			}

		);
		// this.server = launchServer(TransportType.STDIO);

		// register tools here
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
