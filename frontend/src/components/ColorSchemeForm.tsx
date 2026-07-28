import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { randomColorScheme, type ColorScheme } from "../lib/colorScheme";

interface ColorSchemeFormProps {
  colorScheme: ColorScheme;
  onChange: (colorScheme: ColorScheme) => void;
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
      <Typography variant="caption" component="label" htmlFor={id}>
        {label}
      </Typography>
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </Stack>
  );
}

export function ColorSchemeForm({ colorScheme, onChange }: ColorSchemeFormProps) {
  return (
    <Stack component="section" spacing={2}>
      <Typography variant="h6" component="h2">
        Colors
      </Typography>

      <Stack direction="row" spacing={2}>
        <ColorField
          id="background-color"
          label="Background"
          value={colorScheme.backgroundColor}
          onChange={(value) => onChange({ ...colorScheme, backgroundColor: value })}
        />
        <ColorField
          id="cell-color"
          label="Cell"
          value={colorScheme.cellColor}
          onChange={(value) => onChange({ ...colorScheme, cellColor: value })}
        />
        <ColorField
          id="text-color"
          label="Text"
          value={colorScheme.textColor}
          onChange={(value) => onChange({ ...colorScheme, textColor: value })}
        />
        <ColorField
          id="title-color"
          label="Title"
          value={colorScheme.titleColor}
          onChange={(value) => onChange({ ...colorScheme, titleColor: value })}
        />
      </Stack>

      <Button type="button" variant="outlined" size="small" onClick={() => onChange(randomColorScheme())} sx={{ alignSelf: "flex-start" }}>
        Randomize colors
      </Button>
    </Stack>
  );
}
