import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
    <Stack component="section" spacing={2}>
      <Typography variant="h6" component="h2">
        Card details
      </Typography>

      <TextField
        id="card-title"
        label="Card title (optional)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="e.g. Office Party Bingo"
        size="small"
        fullWidth
      />

      <FormControlLabel
        control={
          <Checkbox
            id="has-free-space"
            checked={hasFreeSpace}
            onChange={(e) => onHasFreeSpaceChange(e.target.checked)}
          />
        }
        label="Include a free space in the center"
      />

      {hasFreeSpace && (
        <TextField
          id="free-space"
          label="Free space text (optional)"
          value={freeSpaceText}
          onChange={(e) => onFreeSpaceChange(e.target.value)}
          placeholder="FREE"
          size="small"
          fullWidth
        />
      )}
    </Stack>
  );
}
