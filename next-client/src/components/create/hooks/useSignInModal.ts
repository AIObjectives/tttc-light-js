import { useState, useEffect } from "react";
import { useDeferredValue } from "../hooks/useDeferredValue";

type DeferredUser = ReturnType<typeof useDeferredValue>;

/**
 * Hook to manage sign-in modal visibility.
 * Shows modal when user is not signed in, with deferred behavior to avoid
 * flashing modal on initial page load.
 */
export function useSignInModal(user: DeferredUser) {
  const [modalOpen, setModalOpen] = useState(false);
  const deferredUser = useDeferredValue(user);

  useEffect(() => {
    // Don't show modal during initial deferred state
    if (deferredUser === "deferred") {
      setModalOpen(false);
    } else if (deferredUser === null) {
      // User is not signed in
      setModalOpen(true);
    } else {
      // User is signed in
      setModalOpen(false);
    }
  }, [deferredUser]);

  const handleAuthError = () => {
    setModalOpen(true);
  };

  return {
    modalOpen,
    handleAuthError,
  };
}
