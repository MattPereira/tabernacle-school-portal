import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Role is the admin's call, never read off FACTS (ADR-0001). `student` is the
// default because that is what the native <select> this replaced submitted when
// nobody touched it — the first option wins.
export function RoleSelect({
  id,
  defaultValue = "student",
}: {
  id: string;
  defaultValue?: string;
}) {
  return (
    <Select name="role" defaultValue={defaultValue}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="student">student</SelectItem>
        <SelectItem value="staff">staff</SelectItem>
      </SelectContent>
    </Select>
  );
}
