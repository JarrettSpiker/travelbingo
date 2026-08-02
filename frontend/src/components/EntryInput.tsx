import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { getCardSlotCount, getUniqueEntries, type BingoEntry } from "../lib/bingo";

interface EntryInputProps {
  entries: BingoEntry[];
  hasFreeSpace: boolean;
  onAdd: (entry: string) => void;
  onEdit: (index: number, entry: string) => void;
  onToggleMandatory: (index: number) => void;
  onToggleEnabled: (index: number) => void;
  onRemove: (index: number) => void;
  onOpenSuggestions?: () => void;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function duplicatesAnotherEntry(entries: BingoEntry[], text: string, ignoreIndex?: number): boolean {
  const key = normalize(text);
  return entries.some((entry, i) => i !== ignoreIndex && normalize(entry.text) === key);
}

export function EntryInput({
  entries,
  hasFreeSpace,
  onAdd,
  onEdit,
  onToggleMandatory,
  onToggleEnabled,
  onRemove,
  onOpenSuggestions,
}: EntryInputProps) {
  const [draft, setDraft] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const slotCount = getCardSlotCount(hasFreeSpace);
  const enabledUnique = getUniqueEntries(entries).filter((entry) => entry.enabled !== false);
  const uniqueCount = enabledUnique.length;
  const filledCount = Math.min(uniqueCount, slotCount);
  const mandatoryCount = enabledUnique.filter((entry) => entry.mandatory).length;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    if (duplicatesAnotherEntry(entries, trimmed)) {
      setDuplicateError(`"${trimmed}" is already in the list.`);
      return;
    }

    onAdd(trimmed);
    setDraft("");
    setDuplicateError(null);
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditDraft(entries[index].text);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft("");
    setEditError(null);
  }

  function handleEditSubmit(event: FormEvent, index: number) {
    event.preventDefault();
    const trimmed = editDraft.trim();
    if (!trimmed) return;

    if (duplicatesAnotherEntry(entries, trimmed, index)) {
      setEditError(`"${trimmed}" is already in the list.`);
      return;
    }

    onEdit(index, trimmed);
    cancelEditing();
  }

  return (
    <Stack component="section" spacing={2}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" component="h2">
          Entries
        </Typography>
        {onOpenSuggestions && (
          <Button variant="outlined" size="small" onClick={onOpenSuggestions}>
            See suggestions
          </Button>
        )}
      </Stack>

      <Stack component="form" direction="row" spacing={1} onSubmit={handleSubmit} sx={{ alignItems: "flex-start" }}>
        <TextField
          id="entry-draft"
          label="Add an entry"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDuplicateError(null);
          }}
          placeholder="e.g. Says 'synergy'"
          size="small"
          fullWidth
        />
        <Button type="submit" variant="contained" sx={{ flexShrink: 0 }}>
          Add
        </Button>
      </Stack>
      {duplicateError && <Alert severity="error">{duplicateError}</Alert>}

      <Typography variant="body2">
        {filledCount} / {slotCount} cells filled
        {uniqueCount > slotCount && <> ({uniqueCount - slotCount} extra, used on randomize)</>}
      </Typography>

      {mandatoryCount > slotCount && (
        <Alert severity="warning">
          {mandatoryCount} entries are marked mandatory, but only {slotCount} cells are available — not all of
          them can appear.
        </Alert>
      )}

      <List
        disablePadding
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          columnGap: 3,
        }}
      >
        {entries.map((entry, index) =>
          editingIndex === index ? (
            <ListItem
              key={index}
              disableGutters
              sx={{ display: "block", py: 0.5, gridColumn: { sm: "1 / -1" } }}
            >
              <Stack component="form" direction="row" spacing={1} onSubmit={(e) => handleEditSubmit(e, index)}>
                <TextField
                  value={editDraft}
                  onChange={(e) => {
                    setEditDraft(e.target.value);
                    setEditError(null);
                  }}
                  slotProps={{ htmlInput: { "aria-label": `Edit entry ${entry.text}` } }}
                  autoFocus
                  size="small"
                  fullWidth
                />
                <Button type="submit" size="small" sx={{ flexShrink: 0 }}>
                  Save
                </Button>
                <Button type="button" size="small" sx={{ flexShrink: 0 }} onClick={cancelEditing}>
                  Cancel
                </Button>
              </Stack>
              {editError && (
                <Alert severity="error" sx={{ mt: 0.5 }}>
                  {editError}
                </Alert>
              )}
            </ListItem>
          ) : (
            <ListItem
              key={index}
              disableGutters
              sx={{
                py: 0.5,
                borderColor: "divider",
                borderLeftStyle: "solid",
                borderLeftWidth: { xs: 0, sm: index % 2 === 1 ? 1 : 0 },
                pl: { xs: 0, sm: index % 2 === 1 ? 2 : 0 },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ width: "100%", alignItems: "center" }}>
                <Box
                  sx={{
                    flex: 1,
                    textDecoration: entry.enabled === false ? "line-through" : "none",
                    opacity: entry.enabled === false ? 0.5 : 1,
                  }}
                >
                  {entry.text}
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={entry.enabled !== false}
                      onChange={() => onToggleEnabled(index)}
                      slotProps={{ input: { "aria-label": `Toggle ${entry.text} active` } }}
                    />
                  }
                  label="Active"
                  slotProps={{ typography: { variant: "body2", sx: { whiteSpace: "nowrap" } } }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={entry.mandatory}
                      onChange={() => onToggleMandatory(index)}
                      slotProps={{ input: { "aria-label": `Mark ${entry.text} as mandatory` } }}
                    />
                  }
                  label="Mandatory"
                  disabled={entry.enabled === false}
                  slotProps={{ typography: { variant: "body2", sx: { whiteSpace: "nowrap" } } }}
                />
                <Tooltip title="Edit">
                  <IconButton
                    type="button"
                    size="small"
                    onClick={() => startEditing(index)}
                    aria-label={`Edit ${entry.text}`}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    type="button"
                    size="small"
                    color="error"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${entry.text}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </ListItem>
          ),
        )}
      </List>
    </Stack>
  );
}
