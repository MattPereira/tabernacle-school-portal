// Name parts -> the letters that stand in for a photo. A display derivation
// off FACTS data, the same kind of thing as ./pictures, and shared because
// Staff and Students show the identical circle.

// First and last only — a middle initial in the circle reads as noise at 40px.
// Empty when FACTS gave no name at all: a blank circle rather than a
// placeholder person, because the missing name is the thing worth noticing.
export function initials(firstName: string | null, lastName: string | null): string {
  const firstLetter = (part: string | null) => (part ? ([...part.trim()][0] ?? "") : "");
  return (firstLetter(firstName) + firstLetter(lastName)).toUpperCase();
}
