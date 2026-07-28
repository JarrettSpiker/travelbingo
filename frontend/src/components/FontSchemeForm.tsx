import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { FONT_OPTIONS, type FontScheme } from "../lib/fontScheme";

interface FontSchemeFormProps {
  fontScheme: FontScheme;
  onChange: (fontScheme: FontScheme) => void;
}

export function FontSchemeForm({ fontScheme, onChange }: FontSchemeFormProps) {
  return (
    <Stack component="section" spacing={2}>
      <Typography variant="h6" component="h2">
        Fonts
      </Typography>

      <Stack direction="row" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="title-font-label">Title font</InputLabel>
          <Select
            labelId="title-font-label"
            id="title-font"
            value={fontScheme.titleFont}
            label="Title font"
            onChange={(e) => onChange({ ...fontScheme, titleFont: e.target.value })}
          >
            {FONT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ fontFamily: option.value }}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="cell-font-label">Cell font</InputLabel>
          <Select
            labelId="cell-font-label"
            id="cell-font"
            value={fontScheme.cellFont}
            label="Cell font"
            onChange={(e) => onChange({ ...fontScheme, cellFont: e.target.value })}
          >
            {FONT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ fontFamily: option.value }}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}
