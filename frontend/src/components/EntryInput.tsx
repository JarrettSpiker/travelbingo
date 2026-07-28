import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { CARD_SLOT_COUNT, getUniqueEntries, type BingoEntry } from "../lib/bingo";

interface EntryInputProps {
  entries: BingoEntry[];
  onAdd: (entry: string) => void;
  onEdit: (index: number, entry: string) => void;
  onToggleMandatory: (index: number) => void;
  onRemove: (index: number) => void;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function duplicatesAnotherEntry(entries: BingoEntry[], text: string, ignoreIndex?: number): boolean {
  const key = normalize(text);
  return entries.some((entry, i) => i !== ignoreIndex && normalize(entry.text) === key);
}

export function EntryInput({ entries, onAdd, onEdit, onToggleMandatory, onRemove }: EntryInputProps) {
  const [draft, setDraft] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const uniqueCount = getUniqueEntries(entries).length;
  const filledCount = Math.min(uniqueCount, CARD_SLOT_COUNT);
  const mandatoryCount = entries.filter((entry) => entry.mandatory).length;

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
      <Typography variant="h6" component="h2">
        Entries
      </Typography>

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
        {filledCount} / {CARD_SLOT_COUNT} cells filled
        {uniqueCount > CARD_SLOT_COUNT && <> ({uniqueCount - CARD_SLOT_COUNT} extra, used on randomize)</>}
      </Typography>

      {mandatoryCount > CARD_SLOT_COUNT && (
        <Alert severity="warning">
          {mandatoryCount} entries are marked mandatory, but only {CARD_SLOT_COUNT} cells are available — not all of
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
                <Box sx={{ flex: 1 }}>{entry.text}</Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={entry.mandatory}
                      onChange={() => onToggleMandatory(index)}
                      slotProps={{ input: { "aria-label": `Mark ${entry.text} as mandatory` } }}
                    />
                  }
                  label="Mandatory"
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
