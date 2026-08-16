// Polyfill web-standard APIs missing in the Hermes JavaScript runtime on React Native

if (typeof globalThis.DOMException === 'undefined') {
  class DOMException extends Error {
    public code: number;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
      this.code = 0;
    }
  }
  (globalThis as any).DOMException = DOMException;
}

if (typeof global.DOMException === 'undefined') {
  (global as any).DOMException = globalThis.DOMException;
}
