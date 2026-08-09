import { forwardRef, type CSSProperties, type KeyboardEvent } from "react";
import type { BingoCard, MarkedSlots } from "../lib/bingo";
import type { ColorScheme } from "../lib/colorScheme";
import { computeEdgeEmojiPositions, type EmojiPosition, type EmojiScheme } from "../lib/emojiScheme";
import type { FontScheme } from "../lib/fontScheme";

interface CardGridProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
  /**
   * Grid positions currently marked. Omitting it renders the card exactly as it
   * rendered before marking existed — no rule fires without a mark, so every
   * card saved or exported before this feature is unaffected.
   */
  markedSlots?: MarkedSlots;
  /**
   * Supplied only when the viewer may change this card's marks. Its presence is
   * what makes cells interactive; the server is still the authority, and a
   * refused mark is reverted by the caller.
   */
  onToggleSlot?: (index: number) => void;
}

/** Number of emoji slots around the border; emojis cycle to fill the whole ring. */
const RING_COUNT = 15;

/** Steps the per-cell font size down as text length grows, so cells stay a fixed size. */
function fontScaleForText(text: string): number {
  const length = text.length;
  if (length <= 10) return 1;
  if (length <= 16) return 0.85;
  if (length <= 24) return 0.7;
  if (length <= 32) return 0.55;
  return 0.45;
}

/**
 * Insets each emoji just inside the body edge. Coordinates are clamped to
 * `[--emoji-inset, 100% - --emoji-inset]` so emojis near the corners (whose
 * percentage would otherwise place them on the very edge) stay contained
 * within the padding band on every side.
 */
function edgeLeft(position: EmojiPosition): string {
  return `clamp(var(--emoji-inset), ${position.x}%, calc(100% - var(--emoji-inset)))`;
}

function edgeEmojiStyle(position: EmojiPosition): CSSProperties {
  return {
    left: edgeLeft(position),
    top: `clamp(var(--emoji-inset), ${position.y}%, calc(100% - var(--emoji-inset)))`,
  };
}

export const CardGrid = forwardRef<HTMLDivElement, CardGridProps>(function CardGrid(
  { card, title, colorScheme, fontScheme, emojiScheme, markedSlots, onToggleSlot },
  ref,
) {
  const hasTitle = Boolean(title);
  const positions = computeEdgeEmojiPositions(emojiScheme.emojis, RING_COUNT);

  return (
    <div
      ref={ref}
      className="bingo-card"
      style={{
        backgroundColor: colorScheme.backgroundColor,
        color: colorScheme.textColor,
        fontFamily: fontScheme.cellFont,
      }}
    >
      {hasTitle && (
        <div className="bingo-card-titlebar">
          <h3
            className="bingo-card-title"
            style={{
              color: colorScheme.titleColor,
              fontFamily: fontScheme.titleFont,
            }}
          >
            {title}
          </h3>
        </div>
      )}
      <div className="bingo-card-body">
        {positions.map((position, index) => (
          <span
            key={index}
            className="bingo-edge-emoji"
            style={edgeEmojiStyle(position)}
            aria-hidden="true"
          >
            {position.emoji}
          </span>
        ))}
        <div className="bingo-grid">
          {card.cells.map((cell, index) => {
            const marked = markedSlots?.has(index) ?? false;
            // A blank is the absence of a square rather than an unclaimed one,
            // so it never becomes interactive.
            const toggle =
              onToggleSlot && cell.kind !== "blank" ? () => onToggleSlot(index) : undefined;

            return (
              // Deliberately still a <div> carrying role="button", rather than
              // a real button element. The renderer's rule is that it uses only
              // elements with no UA typography to lose; a button would
              // reintroduce exactly that exposure, and would carry a UA
              // background and border into the exported image as well.
              <div
                key={index}
                className={`bingo-cell bingo-cell-${cell.kind}${toggle ? " bingo-cell-playable" : ""}`}
                style={
                  {
                    backgroundColor: colorScheme.cellColor,
                    "--cell-font-scale": fontScaleForText(cell.text),
                  } as CSSProperties
                }
                role={toggle ? "button" : undefined}
                tabIndex={toggle ? 0 : undefined}
                aria-pressed={toggle ? marked : undefined}
                onClick={toggle}
                onKeyDown={
                  toggle
                    ? (event: KeyboardEvent<HTMLDivElement>) => {
                        // role="button" gets no key activation for free the way
                        // a real button element does.
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        toggle();
                      }
                    : undefined
                }
              >
                {cell.text}
                {marked && (
                  // Two real spans — not an SVG, which is a whole second
                  // rendering model inside a node that must serialize
                  // identically four ways, and not a ::before/::after pair.
                  // Pseudo-element serialization through html-to-image is
                  // precisely the class of silent export regression the guard
                  // exists to catch; a real element is trivially verifiable.
                  <span className="bingo-mark" aria-hidden="true">
                    <span className="bingo-mark-stroke" />
                    <span className="bingo-mark-stroke" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
