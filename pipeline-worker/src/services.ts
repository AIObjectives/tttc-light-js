import type { Cache } from "./cache";
import { CacheServicesLive } from "./cache/services";
import {
  type RefStoreServices,
  RefStoreServicesLive,
} from "./datastore/refstore";

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
