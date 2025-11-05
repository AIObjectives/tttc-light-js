import { RefStoreServicesLive, RefStoreServices } from "./datastore/refstore";

export interface Services {
  RefStore: RefStoreServices;
}

export function initServices(): Services {
  const RefStore = RefStoreServicesLive(process.env);

  return {
    RefStore,
  };
}
