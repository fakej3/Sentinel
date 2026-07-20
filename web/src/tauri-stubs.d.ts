declare module '@tauri-apps/plugin-fs' {
  export function readTextFile(path: string, options?: unknown): Promise<string>
  export function writeTextFile(path: string, data: string, options?: unknown): Promise<void>
  export function mkdir(path: string, options?: unknown): Promise<void>
  export function exists(path: string, options?: unknown): Promise<boolean>
  export const BaseDirectory: Record<string, number>
}

declare module '@tauri-apps/api/core' {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
}

declare module '@tauri-apps/api/event' {
  export function listen<T>(event: string, handler: (e: { payload: T }) => void): Promise<() => void>
}
