import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LinkedViewer } from "@/lib/auth/viewer";

export function HomeScreen({ viewer }: { viewer: LinkedViewer }) {
  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Hi {viewer.name}</CardTitle>
          <CardDescription>
            You&apos;re signed in as {viewer.role === "student" ? "a student" : "staff"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">More portal features will appear here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
