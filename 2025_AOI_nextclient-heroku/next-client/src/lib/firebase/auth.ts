import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "./clientApp";

export function onAuthStateChanged(cb) {
  return _onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Add scopes here if we need access to user data
  // ex: provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  try {
    setPersistence(auth, browserLocalPersistence).then(
      async () => await signInWithPopup(auth, provider),
    );
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
}

export async function signOut() {
  try {
    return auth.signOut();
  } catch (error) {
    console.error("Error signing out with Google", error);
  }
}
