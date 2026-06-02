declare module 'socket.io-client' {
  // Minimal typings to satisfy TS in this project. Replace with official types if installed.
  export type Socket = any;
  export function io(url: string, opts?: any): Socket;
}
