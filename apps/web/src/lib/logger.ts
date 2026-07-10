type Level = "INFO" | "WARN" | "ERROR";

/** HH:MM:SS（UTC）でタイムスタンプを返す。 */
function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/**
 * サーバ（API / server components）用の構造化ログを 1 行で出力する。
 * 例: [server] [06:53:53] INFO request completed reqId=... method=GET path=/api/lives status=200 responseTime=41ms
 */
function logServer(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const suffix = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  // biome/oxlint: サーバログは意図的に console を使う
  console.log(`[server] [${timestamp()}] ${level} ${message}${suffix ? ` ${suffix}` : ""}`);
}

let seq = 0;
function newRequestId(): string {
  seq = (seq + 1) % 1_000_000;
  return `req-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/**
 * API route ハンドラを包み、完了/失敗時に [server] 構造化ログを出す。
 * ハンドラの引数（params 等）は透過的に維持する。
 */
export function withApiLogging<A extends unknown[]>(
  handler: (request: Request, ...args: A) => Response | Promise<Response>,
): (request: Request, ...args: A) => Promise<Response> {
  return async (request: Request, ...args: A): Promise<Response> => {
    const reqId = newRequestId();
    const start = performance.now();
    // 実行時は常に request が渡るが、テスト等の直接呼び出しに備えて防御的に扱う。
    const url = request?.url;
    const method = request?.method;
    let path = url ?? "";
    if (url) {
      try {
        path = new URL(url).pathname;
      } catch {
        path = url;
      }
    }

    try {
      const res = await handler(request, ...args);
      logServer("INFO", "request completed", {
        reqId,
        method,
        path,
        status: res.status,
        responseTime: `${Math.round(performance.now() - start)}ms`,
      });
      return res;
    } catch (err) {
      logServer("ERROR", "request failed", {
        reqId,
        method,
        path,
        responseTime: `${Math.round(performance.now() - start)}ms`,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
