import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { BingoEntry } from "../lib/bingo";
import {
  appendCells,
  SUGGESTED_CATEGORIES,
  SUGGESTED_THEMES,
  type SuggestedTheme,
} from "../lib/suggestions";

interface SuggestionsDialogProps {
  open: boolean;
  onClose: () => void;
  entries: BingoEntry[];
  onAddEntries: (entries: BingoEntry[]) => void;
  onApplyTheme: (theme: SuggestedTheme) => void;
}

interface AddReport {
  added: number;
  skipped: number;
}

export function SuggestionsDialog({
  open,
  onClose,
  entries,
  onAddEntries,
  onApplyTheme,
}: SuggestionsDialogProps) {
  const [categoryId, setCategoryId] = useState<string>(SUGGESTED_CATEGORIES[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<AddReport | null>(null);

  useEffect(() => {
    if (open) {
      setCategoryId(SUGGESTED_CATEGORIES[0]?.id ?? "");
      setSelected(new Set());
      setReport(null);
    }
  }, [open]);

  const category = SUGGESTED_CATEGORIES.find((c) => c.id === categoryId) ?? SUGGESTED_CATEGORIES[0];

  function toggleCell(cell: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cell)) {
        next.delete(cell);
      } else {
        next.add(cell);
      }
      return next;
    });
  }

  function handleAdd() {
    const result = appendCells(entries, [...selected]);
    onAddEntries(result.entries);
    setReport({ added: result.added.length, skipped: result.skipped.length });
    setSelected(new Set());
  }

  function handleApplyTheme(theme: SuggestedTheme) {
    onApplyTheme(theme);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Suggestions</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {SUGGESTED_THEMES.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle1" component="h3">
                Themes
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {SUGGESTED_THEMES.map((theme) => (
                  <Button
                    key={theme.id}
                    variant="outlined"
                    size="small"
                    onClick={() => handleApplyTheme(theme)}
                  >
                    {theme.emojiScheme.emojis.length > 0
                      ? `${theme.emojiScheme.emojis.join(" ")} ${theme.label}`
                      : theme.label}
                  </Button>
                ))}
              </Box>
            </Stack>
          )}

          {SUGGESTED_THEMES.length > 0 && <Divider />}

          <Stack spacing={1}>
            <Typography variant="subtitle1" component="h3">
              Cells
            </Typography>
            {SUGGESTED_CATEGORIES.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No suggested cells are available right now.
              </Typography>
            ) : (
              <>
                <FormControl size="small" fullWidth>
                  <InputLabel id="suggestion-category-label">Category</InputLabel>
                  <Select
                    labelId="suggestion-category-label"
                    id="suggestion-category"
                    value={category?.id ?? ""}
                    label="Category"
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSelected(new Set());
                    }}
                  >
                    {SUGGESTED_CATEGORIES.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {category?.cells.map((cell) => (
                    <Chip
                      key={cell}
                      label={cell}
                      onClick={() => toggleCell(cell)}
                      color={selected.has(cell) ? "primary" : "default"}
                      variant={selected.has(cell) ? "filled" : "outlined"}
                    />
                  ))}
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAdd}
                  disabled={selected.size === 0}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add selected{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>

                {report && (
                  <Alert severity={report.skipped > 0 ? "warning" : "success"}>
                    Added {report.added} {report.added === 1 ? "cell" : "cells"}.
                    {report.skipped > 0 &&
                      ` ${report.skipped} ${report.skipped === 1 ? "was" : "were"} already in your list and skipped.`}
                  </Alert>
                )}
              </>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
