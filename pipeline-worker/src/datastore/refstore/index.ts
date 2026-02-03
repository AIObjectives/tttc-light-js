import admin from "firebase-admin";
import {
  type ReportJob,
  type ReportRef,
  reportJob,
  reportRef,
} from "tttc-common/firebase";
import { z } from "zod";
import { FirebaseRefStore } from "./firebase";
import { PostgresRefStore } from "./postgres";
/**
 * @fileoverview
 *
 * This file contains all the logic for setting up any ref services that we want to have
 *
 * Rough flow:
 *  - ServiceConfig, we parse the provided config variables to create a ServiceConfig. This contains the settings
 *  for our different ref store implementations.
 *  - StoreFactory, we call the createStoreFactory function, taking our ServiceConfig, which returns a factory function
 *  for creating ref stores. The factory function takes the collection name (i.e. a database table name) and a zod parser
 *  that's used to validate the outputs / give our store a specific type signature. It will also automatically apply any variations to the collection name
 *  such as appending _dev to the name for dev env
 * - Creating refstores, we use our factory function to define whatever services we want to provide to the rest of the app.
 *
 * The output of our RefStoreServicesLive is a Result, representing whether we successfully built our ref services.
 */

/**
 * Interface that all RefStores should share
 */
export interface RefStore<T> {
  get: (id: string) => Promise<T | null>;
  create: (data: T) => Promise<string>;
  modify: (id: string, data: T) => Promise<void>;
}

// ============================================================================
// Config
// ============================================================================

const envEnum = z.union([
  z.literal("production"),
  z.literal("development"),
  z.literal("test"),
]);

const whichServiceEnum = z.union([
  z.literal("firebase"),
  z.literal("postgres"),
]);

type Env = {
  node_env: z.infer<typeof envEnum>;
};

/**
 * Configuration for different implementations of our refstore
 */
type ServiceConfig =
  | ({ type: "firebase"; credentials: Record<string, unknown> } & Env)
  | ({ type: "postgres"; connectionString: string } & Env);

const parseSetup = ({
  node_env,
  whichService,
}: {
  node_env: string | undefined;
  whichService: string | undefined;
}): {
  node_env: z.infer<typeof envEnum>;
  whichService: z.infer<typeof whichServiceEnum>;
} => {
  if (!node_env) {
    throw new Error("Missing node_env");
  }

  const parsedNodeEnv = envEnum.safeParse(node_env);
  if (!parsedNodeEnv.success) {
    throw new Error("Malformed node_env");
  }

  if (!whichService) {
    throw new Error("Missing WHICH_SERVICE_REFSTORE");
  }

  const parsedWhichService = whichServiceEnum.safeParse(whichService);
  if (!parsedWhichService.success) {
    throw new Error("Malformed WHICH_SERVICE_REFSTORE");
  }

  return {
    node_env: parsedNodeEnv.data,
    whichService: parsedWhichService.data,
  };
};

/**
 * Generates our refstore service configuration
 */
export const parseConfig = ({
  node_env,
  whichService,
  firebaseCredentials,
  postgresConnectionString,
}: {
  node_env: string | undefined;
  whichService: string | undefined;
  firebaseCredentials?: string;
  postgresConnectionString?: string;
}): ServiceConfig => {
  /**
   * Figure out what service we want to use for our refstore
   */
  const { whichService: service, node_env: node } = parseSetup({
    node_env,
    whichService,
  });

  if (service === "firebase") {
    /**
     * If we need firebase, get the needed config vars from env
     */
    if (!firebaseCredentials) {
      throw new Error("Missing FIREBASE_CREDENTIALS_ENCODED");
    }

    const credentials = JSON.parse(
      Buffer.from(firebaseCredentials, "base64").toString("utf-8"),
    );
    return {
      type: "firebase" as const,
      credentials,
      node_env: node,
    };
  } else if (service === "postgres") {
    /**
     * If we need postgres, get the needed config vars from env
     */
    if (!postgresConnectionString) {
      throw new Error("Missing POSTGRES_CONNECTION_STRING");
    }

    return {
      type: "postgres" as const,
      connectionString: postgresConnectionString,
      node_env: node,
    };
  } else {
    throw new Error(`Invalid WHICH_SERVICE_REFSTORE: ${whichService}`);
  }
};

const initializeFirebase = (
  credentials: Record<string, unknown>,
): admin.firestore.Firestore => {
  try {
    // Type-safe casting to service account for firebase-admin
    const serviceAccount = credentials as admin.ServiceAccount;

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.firestore(app);
  } catch (e) {
    throw new Error(`Firebase initialization failed: ${e}`);
  }
};

// ============================================================================
// Store Factory
// ============================================================================

/**
 * Factory function that returns a refstore
 */
export type RefStoreFactory = <T extends z.ZodTypeAny>(
  collection: string,
  parser: T,
) => RefStore<z.infer<T>>;

const amendCollectionName = (collectionName: string, config: ServiceConfig) => {
  if (config.node_env === "development") return `${collectionName}_dev`;
  else return collectionName;
};

/**
 * Creates a refstore factory given a configuration
 */
export const createStoreFactory = (config: ServiceConfig): RefStoreFactory => {
  /**
   * Firebase config
   */
  if (config.type === "firebase") {
    const firestore = initializeFirebase(config.credentials);
    return <T extends z.ZodTypeAny>(
      collectionName: string,
      parser: T,
    ): RefStore<z.infer<T>> =>
      new FirebaseRefStore<T>(
        firestore.collection(amendCollectionName(collectionName, config)),
        parser,
      );
  } else {
    /**
     * Postgres config
     */
    return <T extends z.ZodTypeAny>(collection: string, parser: T) =>
      new PostgresRefStore(amendCollectionName(collection, config), parser);
  }
};

// ============================================================================
// Application Services
// ============================================================================

/**
 * All ref services
 */
export interface RefStoreServices {
  Report: RefStore<ReportRef>;
  Job: RefStore<ReportJob>;
}

const createRefStoreServices = (
  storeFactory: RefStoreFactory,
): RefStoreServices => ({
  Report: storeFactory("reportRef", reportRef),
  Job: storeFactory("jobRef", reportJob),
});

// ============================================================================
// Live RefStoreServices
// ============================================================================

/**
 * Constructs ref services
 */
export const RefStoreServicesLive = (env: {
  [key: string]: string | undefined;
}): RefStoreServices => {
  const config = parseConfig({
    node_env: env.NODE_ENV,
    whichService: env.WHICH_SERVICE_REFSTORE,
    firebaseCredentials: env.FIREBASE_CREDENTIALS_ENCODED,
    postgresConnectionString: env.POSTGRES_CONNECTION_STRING,
  });

  const storeFactory = createStoreFactory(config);
  return createRefStoreServices(storeFactory);
};
