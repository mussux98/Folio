// Password protection: what the next save does about it. The setting is null
// to save the file as it was opened, '' to save it open to anyone, or a
// password that locks it with AES-256. Nothing changes until the file is saved.
export function createProtection(doc) {
  const openedLocked = doc.needsPassword();
  let unlockedWith = '';
  let setting = null;

  return {
    unlocked(password) {
      unlockedWith = password;
    },

    isProtected: () => (setting === null ? openedLocked : setting !== ''),

    // Returns the setting it replaced, so undo can put it back.
    swap(next) {
      const before = setting;
      setting = next;
      return before;
    },

    // MuPDF splits its options at commas, so a password can't hold one.
    saveOptions() {
      if (setting === null) return '';
      if (setting === '') return ',encrypt=none';
      return `,encrypt=aes-256,user-password=${setting},owner-password=${setting}`;
    },

    // What opens the saved file.
    password: () => (setting === null ? unlockedWith : setting),
  };
}
