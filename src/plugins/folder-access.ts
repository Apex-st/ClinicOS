import { registerPlugin, WebPlugin } from "@capacitor/core";

export type FolderPickResult = { uri: string; name: string };
export type FolderMissing = { missing: true };
export type FolderWriteResult = { lastModified: number; size: number };

export interface FolderAccessPlugin {
  pickDirectory(): Promise<FolderPickResult>;
  restoreDirectory(): Promise<FolderPickResult | FolderMissing>;
  forgetDirectory(): Promise<void>;
  writeFromCache(opts: { cacheFile: string; fileName: string }): Promise<FolderWriteResult>;
  readToCache(opts: { cacheFile: string; fileName: string }): Promise<FolderWriteResult | FolderMissing>;
}

class FolderAccessWeb extends WebPlugin implements FolderAccessPlugin {
  async pickDirectory(): Promise<FolderPickResult> {
    throw new Error("web-stub");
  }
  async restoreDirectory(): Promise<FolderMissing> {
    return { missing: true };
  }
  async forgetDirectory() {}
  async writeFromCache(): Promise<FolderWriteResult> {
    throw new Error("web-stub");
  }
  async readToCache(): Promise<FolderMissing> {
    return { missing: true };
  }
}

export const FolderAccess = registerPlugin<FolderAccessPlugin>("FolderAccess", {
  web: () => new FolderAccessWeb(),
});
