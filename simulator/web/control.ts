type Pending = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ControlClient {
  private url: string;
  private timeoutMs: number;
  private socket: WebSocket | null = null;
  private connection: Promise<WebSocket> | null = null;
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private closed = false;

  constructor(url: string, timeoutMs = 3000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private connect(): Promise<WebSocket> {
    if (this.closed) return Promise.reject(Error("遥控连接已关闭"));
    if (this.connection) return this.connection;
    const socket = this.socket = new WebSocket(this.url);
    this.connection = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(Error("WS 连接超时"));
        socket.close();
      }, this.timeoutMs);
      socket.onopen = () => { clearTimeout(timer); resolve(socket); };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        clearTimeout(timer);
        const error = Error("遥控连接断开");
        reject(error);
        if (this.socket === socket) {
          this.socket = null;
          this.connection = null;
          this.rejectPending(error);
        }
      };
      socket.onmessage = event => {
        let message;
        try { message = JSON.parse(event.data); }
        catch { socket.close(); return; }
        if (!message || !Number.isInteger(message.id) || typeof message.ok !== "boolean") {
          socket.close(); return;
        }
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.ok) request.resolve(message.data);
        else request.reject(Error(message.error || "请求失败"));
      };
    });
    return this.connection;
  }

  async request<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const socket = await this.connect();
    if (this.closed || socket.readyState !== WebSocket.OPEN) throw Error("遥控连接断开");
    const id = this.sequence = this.sequence % 2147483647 + 1;
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("WS 请求超时"));
        socket.close();
      }, this.timeoutMs);
      this.pending.set(id, { resolve: data => resolve(data as T), reject, timer });
      try { socket.send(JSON.stringify({ id, path, query })); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close(): void {
    this.closed = true;
    this.rejectPending(Error("遥控连接已关闭"));
    this.socket?.close();
  }
}
