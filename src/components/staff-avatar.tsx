"use client";

import Image from "next/image";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// The rendered box. next/image requests the photo at this size instead of
// shipping the full FACTS portrait, so this has to stay in step with the
// `size-14` below — Tailwind only sees classes written out in full, which is
// why the size lives in two places rather than one constant.
const SIZE = 56;

// A colleague's face, or their initials. Three things land in initials and all
// of them look the same to the reader: FACTS has no photo, the filename wasn't
// one we'd derive a URL from, and the image failed in the browser (#52).
//
// The initials sit underneath rather than beside: they're what shows while the
// photo loads, and what's left if it never does.
//
// A rounded square, a radius step tighter than the card it sits in. The
// primitive defaults to a circle, so every layer — the box, its border ring,
// the fallback, and the photo — has to be squared off.
export function StaffAvatar({ initials, photoUrl }: { initials: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);

  return (
    <Avatar className="size-14 shrink-0 rounded-md after:rounded-md">
      <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
      {photoUrl && !failed && (
        <Image
          src={photoUrl}
          // Decorative: the name it belongs to is right beside it.
          alt=""
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 size-full rounded-md object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </Avatar>
  );
}
