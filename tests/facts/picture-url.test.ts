import { describe, expect, it } from "vitest";

import { factsPictureUrl } from "@/lib/facts/pictures";

// FACTS hosts staff photos itself; the portal only ever derives a URL from the
// filename FACTS gave us. Anything that isn't a plain filename must fall back
// to null so the row shows initials rather than fetching somewhere unexpected.
describe("FACTS picture URL derivation", () => {
  it("appends the filename to the fixed FACTS tenant base", () => {
    expect(factsPictureUrl("1203006.jpg")).toBe(
      "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/1203006.jpg",
    );
  });

  it("treats an absent or blank filename as no photo", () => {
    expect(factsPictureUrl(null)).toBeNull();
    expect(factsPictureUrl(undefined)).toBeNull();
    expect(factsPictureUrl("")).toBeNull();
    expect(factsPictureUrl("   ")).toBeNull();
  });

  it("trims the surrounding whitespace FACTS pads text with", () => {
    expect(factsPictureUrl("  1203006.jpg  ")).toBe(
      "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/1203006.jpg",
    );
  });

  it("escapes a filename rather than letting it change the URL", () => {
    // Spaces and unicode are legal in a FACTS filename; anything else that
    // would be read as URL syntax gets encoded, not honoured.
    expect(factsPictureUrl("Jane Doe.jpg")).toBe(
      "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/Jane%20Doe.jpg",
    );
    expect(factsPictureUrl("%2e%2e%2fsecret.jpg")).toBe(
      "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/%252e%252e%252fsecret.jpg",
    );
  });

  it("rejects anything that would move off the pictures location", () => {
    for (const path of [
      "https://evil.example.com/x.jpg",
      "//evil.example.com/x.jpg",
      "../../../etc/passwd",
      "..%2fx.jpg",
      "sub/dir/x.jpg",
      "sub\\dir\\x.jpg",
      ".hidden.jpg",
      "x.jpg?redirect=1",
      "x.jpg#frag",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "x\n.jpg",
    ]) {
      expect(factsPictureUrl(path), path).toBeNull();
    }
  });
});
