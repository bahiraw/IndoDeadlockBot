if (typeof globalThis.File === 'undefined') {
  class FilePolyfill extends globalThis.Blob {
    name: string;
    lastModified: number;
    constructor(
      fileBits: BlobPart[],
      fileName: string,
      options?: FilePropertyBag
    ) {
      super(fileBits, options);
      this.name = fileName;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  }
  (globalThis as unknown as { File: typeof FilePolyfill }).File = FilePolyfill;
}

export {};
