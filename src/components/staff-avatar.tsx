import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// A colleague's face, or their initials. Three things land in initials and all
// of them look the same to the reader: FACTS has no photo, the filename wasn't
// one we'd derive a URL from, and the image failed in the browser — the last of
// those is the primitive's own image/fallback coordination, not ours (#52).
//
// Deliberately a plain <img> straight at FACTS, not next/image: routing photos
// through the optimizer would have the portal fetch and cache the bytes, and
// the portal is to store none (#52). It costs us the resize — FACTS serves the
// full portrait for a 40px circle.
export function StaffAvatar({ initials, photoUrl }: { initials: string; photoUrl: string | null }) {
  return (
    <Avatar size="lg" className="shrink-0">
      {/* Decorative: the name it belongs to is right beside it. */}
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
