// Where a FACTS profile photo lives. FACTS hosts the bytes on the school's own
// tenant site and serves them publicly, so the portal stores no image and needs
// no credentialed proxy — it only turns the filename in the snapshot into a URL
// (#49, Implementation Decisions).

// Non-secret, fixed at code level: the school's FACTS tenant pictures folder.
// Live-verified 2026-07-27 (HTTP 200, JPEG). Not configurable — a value that
// could be swapped by env is a host this module can no longer promise.
export const FACTS_PICTURE_BASE_URL = "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/";

// FACTS gives us a filename, so a filename is all we accept: anything carrying
// URL or path syntax (or a control character) could point the browser somewhere
// other than the pictures folder, and is treated as "no photo" instead.
const NOT_A_FILENAME = /[/\\?#:]|\.\.|[\u0000-\u001f\u007f]/;

// The photo URL for a FACTS picture path, or null when there isn't a usable
// one. Callers render initials on null — every rejection is a silent fallback,
// never a broken image (#52).
export function factsPictureUrl(pathToPicture: string | null | undefined): string | null {
  const filename = pathToPicture?.trim();
  if (!filename) return null;
  // A leading dot is a dotfile or a traversal fragment, never a photo we want.
  if (filename.startsWith(".")) return null;
  if (NOT_A_FILENAME.test(filename)) return null;

  // Belt and braces: escaping means even a name we accepted can only ever be
  // one path segment under the base.
  return FACTS_PICTURE_BASE_URL + encodeURIComponent(filename);
}
