import { forwardRef, type CSSProperties } from "react";
import type { BingoCard } from "../lib/bingo";
import type { ColorScheme } from "../lib/colorScheme";
import { computeEdgeEmojiPositions, type EmojiPosition, type EmojiScheme } from "../lib/emojiScheme";
import type { FontScheme } from "../lib/fontScheme";

interface CardGridProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
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
  { card, title, colorScheme, fontScheme, emojiScheme },
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
          {card.cells.map((cell, index) => (
            <div
              key={index}
              className={`bingo-cell bingo-cell-${cell.kind}`}
              style={
                {
                  backgroundColor: colorScheme.cellColor,
                  "--cell-font-scale": fontScaleForText(cell.text),
                } as CSSProperties
              }
            >
              {cell.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
