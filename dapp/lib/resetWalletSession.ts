// WalletConnect v2 keeps its pairing/session state in IndexedDB
// (WALLET_CONNECT_V2_INDEXED_DB), separate from wagmi/RainbowKit's
// localStorage keys. A normal page reload or app restart never touches
// IndexedDB, so a dead/expired session just keeps trying to resume itself -
// that's what makes the connect modal reappear on its own and makes wallet
// apps (e.g. Bitget) hang on a stuck pairing request.
//
// This wipes both storage layers for the current origin and reloads, so the
// next connect attempt starts from a clean slate.
export function resetWalletSession() {
  try {
    Object.keys(localStorage)
      .filter((k) => /wagmi|walletconnect|wc@2|rk-/i.test(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage can throw in some locked-down webviews; ignore and
    // still try to clear IndexedDB below.
  }

  if (typeof indexedDB !== "undefined" && indexedDB.databases) {
    indexedDB
      .databases()
      .then((dbs) =>
        Promise.all(
          dbs.map((db) => db.name && indexedDB.deleteDatabase(db.name))
        )
      )
      .finally(() => window.location.reload());
  } else {
    window.location.reload();
  }
}
