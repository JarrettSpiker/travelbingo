## 1. Font scheme

- [x] 1.1 Add a pure TS `fontScheme` module: a `FontScheme` type (`titleFont`, `cellFont`), a fixed list of font options, and a default scheme
- [x] 1.2 Add a font scheme form (title and cell font dropdowns) and wire it into app state
- [x] 1.3 Apply the selected title font and cell font to the card on screen and in print

## 2. Title color

- [x] 2.1 Extend the color scheme type, default, and random generator to include an independent `titleColor`
- [x] 2.2 Add a title color control alongside the existing color controls and include it in color randomization
- [x] 2.3 Apply the title color to the card title on screen and in print

## 3. Optional free space

- [x] 3.1 Add a `hasFreeSpace` option to the card model and derive capacity (24 with a free space, 25 without)
- [x] 3.2 Add a toggle to include/exclude the center free space (default on); disable the free-space text input when off
- [x] 3.3 Thread the free-space toggle through the live builder, randomize builder, and mandatory-entry selection

## 4. URL sharing (schema v3)

- [x] 4.1 Encode the free-space toggle, title color, and font scheme into the `card` URL parameter with a schema version
- [x] 4.2 Decode with backward-compatible defaults for missing fields so older (v1/v2) URLs still load
- [x] 4.3 On load, restore the free-space state, title color, and font scheme from the URL

## 5. Tests and verification

- [x] 5.1 Add/extend unit tests for the font scheme, the four-color scheme (including randomization), and 24/25 capacity behavior
- [x] 5.2 Add/extend unit tests for URL round-tripping the new fields and for decoding older payloads via defaults
- [x] 5.3 Verify exported URLs opened fresh reproduce the card exactly, including fonts, title color, and free-space state
