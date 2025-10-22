import { Effect, Context, Option, pipe, Layer, flow as compose } from "effect";
import * as admin from "firebase-admin";
import {
  reportJob,
  reportRef,
  ReportRef,
  ReportJob,
} from "tttc-common/firebase";
import { zodSafeParseEffect } from "src/utilities";

/**
 * @fileoverview
 *
 * This file contains the services and live implementations to access our refs from firestore
 *
 * Relevant Effect docs:
 * https://effect.website/docs/requirements-management/services/
 * https://effect.website/docs/requirements-management/layers/
 *
 *
 * Note: this can be extended in the future to use more than just Firestore. You just need
 * to create another implementation of RefStoreService and apply it to the services that its used in.
 */

type Option<T> = Option.Option<T>;

/**
 * The refs stored should be key-value pairs
 */
type Document = {
  [field: string]: any;
};

/**
 * Config service for Firebase
 *
 * TODO: Make default implementation
 */
export class FirebaseConfig extends Effect.Service<FirebaseConfig>()(
  "FirebaseConfig",
  {
    effect: Effect.gen(function* () {
      return {
        FIREBASE_CREDENTIALS: "",
      };
    }),
    accessors: true,
  },
) {}

/**
 * Service that wraps our FireStore client
 *
 * Makes it easier to mock + should cache so it only calls initApp once.
 */
export class FireStore extends Effect.Service<FireStore>()("FireStore", {
  effect: Effect.gen(function* () {
    const { FIREBASE_CREDENTIALS } = yield* FirebaseConfig;
    const app = admin.initializeApp({
      credential: admin.credential.cert(FIREBASE_CREDENTIALS),
    });
    return admin.firestore(app);
  }),
  dependencies: [FirebaseConfig.Default],
}) {}

/**
 * Service for providing the collection name to our firestore services
 *
 * Uses an effect because we'll need to read the env or config files
 */
export class CollectionName extends Context.Tag("CollectionName")<
  CollectionName,
  Effect.Effect<string>
>() {}

/**
 * Service for getting, creating, and modifying refs
 *
 * This should not be called directly outside this module. It's intended to be used
 * for making more specific ref services.
 */
export class RefStoreService extends Effect.Service<RefStoreService>()(
  "RefStoreService",
  {
    effect: Effect.gen(function* () {
      const db = yield* FireStore;
      const collection_name = yield* yield* CollectionName;
      return {
        get: (id: string) => {
          const docRef = db.collection(collection_name).doc(id);
          return pipe(
            Effect.tryPromise(async () => await docRef.get()),
            Effect.map((doc) => doc.data()),
            Effect.map(Option.fromNullable),
          );
        },

        create: <T extends Document>(data: T) => {
          const docRef = db.collection(collection_name);
          return pipe(
            Effect.tryPromise(async () => await docRef.add(data)),
            Effect.map((doc) => doc.id),
          );
        },

        modify: <T extends Document>(id: string, data: T) => {
          const docRef = db.collection(collection_name).doc(id);
          const transaction = Effect.tryPromise(() =>
            db.runTransaction(async (transaction) => {
              const run = pipe(
                /**
                 * See if the document exists in Firestore
                 */
                Effect.tryPromise(() => transaction.get(docRef)),
                Effect.map((doc) => doc.data()),
                Effect.flatMap(Effect.fromNullable),
                /**
                 * If the document exists, modify it.
                 */
                Effect.andThen(() => transaction.update(docRef, data)),
              );
              return run;
            }),
          ).pipe(Effect.flatten);

          return transaction;
        },
      };
    }),
  },
) {}

const parseReportRef = zodSafeParseEffect(reportRef);

/**
 * Service for accessing our report refs
 */
export class ReportRefService extends Effect.Service<ReportRefService>()(
  "ReportRefService",
  {
    effect: Effect.gen(function* () {
      const refstore = yield* RefStoreService;

      return {
        get: compose(
          refstore.get,
          // Effect<Option<Ref>> -> Effect<Option<Ref>, ZodParseError>
          Effect.flatMap(Effect.transposeMapOption(parseReportRef)),
        ),
        create: (data: ReportRef) => refstore.create(data),
        modify: (id: string, data: ReportRef) => refstore.modify(id, data),
      };
    }),
    dependencies: [RefStoreService.Default],
  },
) {}

/**
 * Live implementation of our report ref colleciton name
 */
const ReportRefCollectionLive = Layer.succeed(
  CollectionName,
  Effect.succeed("TODO"),
);

/**
 * Live layer implementation of our ReportRefService.
 *
 * This is provided to fullfill the ReportRefService requirement
 */
export const ReportRefServiceLive = ReportRefService.Default.pipe(
  Layer.provide(ReportRefCollectionLive),
  Layer.provide(FireStore.Default),
);

const parseJobRef = zodSafeParseEffect(reportJob);

/**
 * Service for accessing our job refs
 */
export class JobRefService extends Effect.Service<JobRefService>()(
  "JobRefService",
  {
    effect: Effect.gen(function* () {
      const refstore = yield* RefStoreService;

      return {
        get: compose(
          refstore.get,
          // Effect<Option<Ref>> -> Effect<Option<Ref>, ZodParseError>
          Effect.flatMap(Effect.transposeMapOption(parseJobRef)),
        ),
        create: (data: ReportJob) => refstore.create(data),
        modify: (id: string, data: ReportRef) => refstore.modify(id, data),
      };
    }),
    dependencies: [RefStoreService.Default],
  },
) {}

/**
 * Live implementation of our job ref colleciton name
 */
const JobRefCollectionLive = Layer.succeed(
  CollectionName,
  Effect.succeed("TODO"),
);

/**
 * Live layer implementation of our JobRefService.
 *
 * This is provided to fullfill the JobRefService requirement
 */
export const JobRefServiceLive = JobRefService.Default.pipe(
  Layer.provide(JobRefCollectionLive),
  Layer.provide(FireStore.Default),
);
