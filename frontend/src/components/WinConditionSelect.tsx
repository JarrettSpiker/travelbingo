import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIN_CONDITION_LABELS, type WinCondition } from "@/lib/winCondition";

/**
 * The trip-form control for the win condition. Unlike the mode — fixed for a
 * trip's lifetime — the target stays editable after creation, so this renders
 * the same on the create and edit forms.
 */
export function WinConditionSelect({
  id,
  value,
  onChange,
}: {
  /** Wired through Field's render prop so the control and label connect. */
  id?: string;
  value: WinCondition;
  onChange: (value: WinCondition) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as WinCondition)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(WIN_CONDITION_LABELS) as WinCondition[]).map((condition) => (
          <SelectItem key={condition} value={condition}>
            {WIN_CONDITION_LABELS[condition]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
