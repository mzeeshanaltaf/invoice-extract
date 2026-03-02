/**
 * n8n Webhook Client
 *
 * All backend logic is handled by n8n workflows.
 * This module provides a typed wrapper for calling n8n webhook endpoints.
 */

const N8N_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

/** Webhook path constants for the 4 distinct n8n endpoints */
export const N8N_ENDPOINTS = {
  OCR: "6a9405d6-dcaf-4cbf-b83d-04a4535610f1",
  ANALYTICS: "48a48758-6c73-4d34-8453-8a1378c297a3",
  CREDITS: "818c0107-078c-40c9-9761-c3f25eac49b0",
  DOCUMENTS: "46ed3df3-414b-4e29-b1af-579c10db14cf",
} as const;

export class N8nError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "N8nError";
  }
}

/**
 * Call an n8n webhook endpoint with a JSON payload.
 *
 * @param endpoint - The webhook path (UUID from N8N_ENDPOINTS)
 * @param payload  - JSON body to send
 * @returns Parsed JSON response from n8n
 */
export async function callN8nWebhook<TResponse = unknown>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  if (!N8N_BASE_URL) {
    throw new N8nError("N8N_WEBHOOK_BASE_URL environment variable is not set.");
  }
  if (!N8N_API_KEY) {
    throw new N8nError("N8N_API_KEY environment variable is not set.");
  }

  const url = `${N8N_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": N8N_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new N8nError(
      `n8n webhook call failed: ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<TResponse>;
}

/**
 * Call an n8n webhook endpoint with multipart/form-data (for file uploads).
 *
 * @param endpoint - The webhook path (UUID from N8N_ENDPOINTS)
 * @param formData - FormData body containing files and fields
 * @returns Parsed JSON response from n8n
 */
export async function callN8nWebhookFormData<TResponse = unknown>(
  endpoint: string,
  formData: FormData
): Promise<TResponse> {
  if (!N8N_BASE_URL) {
    throw new N8nError("N8N_WEBHOOK_BASE_URL environment variable is not set.");
  }
  if (!N8N_API_KEY) {
    throw new N8nError("N8N_API_KEY environment variable is not set.");
  }

  const url = `${N8N_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": N8N_API_KEY,
      // Do not set Content-Type — fetch auto-sets it with the boundary for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    throw new N8nError(
      `n8n webhook call failed: ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<TResponse>;
}
