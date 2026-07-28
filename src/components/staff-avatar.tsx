"use client";

import Image from "next/image";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// The rendered box, matching Avatar's `lg` (size-10). next/image requests the
// photo at this size instead of shipping the full FACTS portrait.
const SIZE = 40;

// A colleague's face, or their initials. Three things land in initials and all
// of them look the same to the reader: FACTS has no photo, the filename wasn't
// one we'd derive a URL from, and the image failed in the browser (#52).
//
// The initials sit underneath rather than beside: they're what shows while the
// photo loads, and what's left if it never does.
export function StaffAvatar({ initials, photoUrl }: { initials: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);

  return (
    <Avatar size="lg" className="shrink-0">
      <AvatarFallback>{initials}</AvatarFallback>
      {photoUrl && !failed && (
        <Image
          src={photoUrl}
          // Decorative: the name it belongs to is right beside it.
          alt=""
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 size-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </Avatar>
  );
}
