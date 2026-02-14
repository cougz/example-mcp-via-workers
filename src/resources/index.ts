import type { ResourceDefinition } from "../types";

export const resources: ResourceDefinition[] = [];

export function registerResources(server: {
  resource: (
    name: string,
    template: string,
    handler: (uri: URL) => Promise<{
      contents: Array<{ uri: string; mimeType?: string; text: string }>;
    }>
  ) => void;
}) {
  for (const resource of resources) {
    server.resource(resource.name, resource.uri, async (uri: URL) => {
      const result = await resource.handler(uri);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: resource.mimeType ?? "text/plain",
            text: result.content,
          },
        ],
      };
    });
  }
}
