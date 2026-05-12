# Admin Runbook

## Updating a user's apiTier via Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com) and select the project.
2. Navigate to **Firestore Database**.
3. Open the `users` collection (or `users_dev` in development).
4. Find the user document by their Firebase UID.
5. Edit the following fields:
   - `apiTier` (string) — valid values: `"free"` or `"standard"` (case-sensitive)
   - `apiTierUpdatedAt` (timestamp) — set to the current time
   - `apiTierUpdatedBy` (string) — the Firebase UID of the admin making the change

Changes apply on the next request from the user. No client refresh is needed because the tier is looked up at validation time.

## Notes

- Legacy users without an `apiTier` field are treated as `"free"` by all consumers via `user.apiTier ?? "free"`.
- Schema version: `SCHEMA_VERSIONS.USER_DOCUMENT = 2`
