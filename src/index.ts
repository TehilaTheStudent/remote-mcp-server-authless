import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { launchServer, TransportType } from "@trc-sdlc-huawei/tehila-mcp-openapi";



type Props = {
	bearerToken: string;
};
// Define our MCP agent with tools
export class MyMCP extends McpAgent<Props> {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});


	async init() {
		this.server = await launchServer(
			TransportType.STDIO,
			{
				// tools: [
				// 	// Simple tool with Zod schema: [name, schema, handler]
				// 	[
				// 		"calculate-bmi",
				// 		// Define schema using Zod
				// 		{
				// 			weightKg: z.number(),
				// 			heightM: z.number(),
				// 		},
				// 		async ({ weightKg, heightM }: { weightKg: number; heightM: number }) => ({
				// 			content: [
				// 				{
				// 					type: "text",
				// 					text: String(weightKg / (heightM * heightM)),
				// 				},
				// 			],
				// 		}),
				// 	],
				// 	// Tool with more complex Zod schema: [name, schema, handler]
				// 	[
				// 		"fetch-weather",
				// 		{ city: z.string() },
				// 		async ({ city }: { city: string }) => {
				// 			const response = await fetch(`https://api.weather.com/${city}`);
				// 			const data = await response.text();
				// 			return {
				// 				content: [{ type: "text", text: data }],
				// 			};
				// 		},
				// 	],
				// ],
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
						"x-auth-token": this.props.bearerToken,
					},
				}
			}

		);

		// register tools here
		// Tool that returns the user's bearer token
		// This is just for demonstration purposes, don't actually create a tool that does this!
		this.server.tool("getToken", {}, async () => ({
			content: [
				{
					type: "text",
					text: String(`User's token: ${this.props.bearerToken}`),
				},
			],
		}));
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			const bearerToken= request.headers.get("Authorization")?.split(" ")[1];
			ctx.props = {
				bearerToken: bearerToken,
				// could also add arbitrary headers/parameters here to pass into the MCP client
			};
			if (!bearerToken) {
				return new Response("Unauthorized", { status: 401 });
			}
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
