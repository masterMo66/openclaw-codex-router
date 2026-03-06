import type {
  AcpClient,
  EnsureSessionInput,
  EnsureSessionOutput,
  SendMessageInput,
  SendMessageOutput,
} from "./acp-client.js";

export class HttpAcpClient implements AcpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async ensureSession(input: EnsureSessionInput): Promise<EnsureSessionOutput> {
    const response = await fetch(`${this.baseUrl}/sessions/ensure`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`ensureSession failed: ${response.status}`);
    }

    return (await response.json()) as EnsureSessionOutput;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    const response = await fetch(`${this.baseUrl}/sessions/${input.sessionId}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ text: input.text }),
    });

    if (!response.ok) {
      throw new Error(`sendMessage failed: ${response.status}`);
    }

    return (await response.json()) as SendMessageOutput;
  }

  async closeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.headers(),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`closeSession failed: ${response.status}`);
    }
  }

  async isHealthy(sessionId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/health`, {
      method: "GET",
      headers: this.headers(),
    });

    if (response.status === 404 || !response.ok) {
      return false;
    }

    const body = (await response.json()) as { healthy?: boolean };
    return body.healthy === true;
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      "content-type": "application/json",
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}
