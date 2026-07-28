"use client";

import Image from "next/image";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// next/image requests the photo at its rendered size instead of shipping the
// full FACTS portrait. Keep these values in step with the explicit Tailwind
// classes below; Tailwind sees literal class names, not generated ones.
const SIZE = { default: 56, large: 96 } as const;

// A face, or its initials — a colleague's on Staff, a child's on Students.
// Three things land in initials and all of them look the same to the reader:
// FACTS has no photo, the filename wasn't one we'd derive a URL from, and the
// image failed in the browser (#52).
//
// The initials sit underneath rather than beside: they're what shows while the
// photo loads, and what's left if it never does.
//
// A rounded square, a radius step tighter than the card it sits in. The
// primitive defaults to a circle, so every layer — the box, its border ring,
// the fallback, and the photo — has to be squared off.
export function PersonAvatar({
  initials,
  photoUrl,
  size = "default",
}: {
  initials: string;
  photoUrl: string | null;
  size?: keyof typeof SIZE;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Avatar className={`${size === "large" ? "size-24" : "size-14"} shrink-0 rounded-md after:rounded-md`}>
      <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
      {photoUrl && !failed && (
        <Image
          src={photoUrl}
          // Decorative: the name it belongs to is right beside it.
          alt=""
          width={SIZE[size]}
          height={SIZE[size]}
          className="absolute inset-0 size-full rounded-md object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </Avatar>
  );
}
