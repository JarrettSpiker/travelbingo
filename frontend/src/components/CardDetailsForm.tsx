import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/brand";

interface CardDetailsFormProps {
  title: string;
  onTitleChange: (title: string) => void;
  hasFreeSpace: boolean;
  onHasFreeSpaceChange: (hasFreeSpace: boolean) => void;
  freeSpaceText: string;
  onFreeSpaceChange: (freeSpaceText: string) => void;
}

export function CardDetailsForm({
  title,
  onTitleChange,
  hasFreeSpace,
  onHasFreeSpaceChange,
  freeSpaceText,
  onFreeSpaceChange,
}: CardDetailsFormProps) {
  return (
    <div className="grid gap-4">
      <Field htmlFor="card-title" label="Card title (optional)">
        {({ id }) => (
          <Input
            id={id}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={brand.copy.editor.titlePlaceholder}
          />
        )}
      </Field>

      {/*
        Radix's Checkbox is a button, not an <input>, so the label has to be
        associated by id rather than by wrapping — and clicking the text has to
        work, which `htmlFor` gives us.
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="has-free-space"
          checked={hasFreeSpace}
          onCheckedChange={(checked) => onHasFreeSpaceChange(checked === true)}
        />
        <Label htmlFor="has-free-space" className="font-normal">
          Include a free space in the center
        </Label>
      </div>

      {hasFreeSpace && (
        <Field htmlFor="free-space" label="Free space text (optional)">
          {({ id }) => (
            <Input
              id={id}
              value={freeSpaceText}
              onChange={(e) => onFreeSpaceChange(e.target.value)}
              placeholder="FREE"
            />
          )}
        </Field>
      )}
    </div>
  );
}
