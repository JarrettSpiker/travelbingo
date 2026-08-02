import { useEffect, useRef, useState } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { MAX_EMOJIS, parseEmojis, type EmojiScheme } from "../lib/emojiScheme";

interface EmojiSchemeFormProps {
  emojiScheme: EmojiScheme;
  onChange: (emojiScheme: EmojiScheme) => void;
}

export function EmojiSchemeForm({ emojiScheme, onChange }: EmojiSchemeFormProps) {
  const [draft, setDraft] = useState(() => emojiScheme.emojis.join(" "));
  const lastEmitted = useRef(emojiScheme.emojis.join("\u0000"));
  const [pickerAnchor, setPickerAnchor] = useState<HTMLButtonElement | null>(null);

  // Sync the field when the scheme changes from the outside (theme preset, URL load)
  // without clobbering what the user is typing.
  useEffect(() => {
    const incoming = emojiScheme.emojis.join("\u0000");
    if (incoming !== lastEmitted.current) {
      setDraft(emojiScheme.emojis.join(" "));
      lastEmitted.current = incoming;
    }
  }, [emojiScheme]);

  function emit(emojis: string[]) {
    lastEmitted.current = emojis.join("\u0000");
    onChange({ emojis });
  }

  function handleChange(value: string) {
    // Restrict the field to emojis only: keep emoji graphemes, drop everything
    // else, so the draft never holds non-emoji text.
    const parsed = parseEmojis(value);
    setDraft(parsed.join(" "));
    emit(parsed);
  }

  function handleEmojiPick(emoji: string) {
    const next = [...emojiScheme.emojis];
    if (!next.includes(emoji) && next.length < MAX_EMOJIS) {
      next.push(emoji);
      setDraft(next.join(" "));
      emit(next);
    }
  }

  return (
    <Stack component="section" spacing={2}>
      <Typography variant="h6" component="h2">
        Emojis
      </Typography>

      <TextField
        id="emoji-input"
        label="Border emojis"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        helperText={`Up to ${MAX_EMOJIS} emojis decorate the card border.`}
        size="small"
        fullWidth
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Browse emojis"
                  size="small"
                  onClick={(e) => setPickerAnchor(e.currentTarget)}
                  edge="end"
                >
                  <EmojiEmotionsIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Popover
        open={Boolean(pickerAnchor)}
        anchorEl={pickerAnchor}
        onClose={() => setPickerAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {/*
          emojiStyle MUST stay NATIVE: every other style (APPLE/TWITTER/etc.)
          makes runtime CDN image requests to jsdelivr, which would violate the
          app's client-side-only/offline constraint. Native renders glyphs only.
        */}
        <EmojiPicker
          onEmojiClick={(data) => handleEmojiPick(data.emoji)}
          emojiStyle={EmojiStyle.NATIVE}
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          width={320}
          height={360}
        />
      </Popover>
    </Stack>
  );
}
