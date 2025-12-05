import { RefStoreServicesLive, RefStoreServices } from "./datastore/refstore";
import { CacheServicesLive } from "./cache/services";
import { Cache } from "./cache";

export interface Services {
  RefStore: RefStoreServices;
  Cache: Cache;
}

export function initServices(): Services {
  const RefStore = RefStoreServicesLive(process.env);
  const Cache = CacheServicesLive(process.env);

  return {
    RefStore,
    Cache,
  };
}
