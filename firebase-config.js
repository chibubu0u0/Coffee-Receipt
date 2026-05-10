export const collectionName = 'coffee_beans';

export async function getFirebaseConfig() {
  const response = await fetch('/api/firebase-config', { cache: 'no-store' });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const missing = Array.isArray(detail.missing) ? ` Missing: ${detail.missing.join(', ')}` : '';
    throw new Error(`Firebase config could not be loaded.${missing}`);
  }

  const data = await response.json();
  return data.firebaseConfig;
}
