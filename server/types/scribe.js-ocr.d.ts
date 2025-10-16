declare module 'scribe.js-ocr' {
  interface ScribeOptions {
    [key: string]: unknown;
  }

  interface ScribeAPI {
    extractText(files: string[], langs?: string[], outputFormat?: string, options?: ScribeOptions): Promise<string>;
    terminate(): Promise<void>;
  }

  const scribe: ScribeAPI;
  export default scribe;
}
