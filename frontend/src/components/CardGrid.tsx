import type { CSSProperties } from "react";
import type { BingoCard } from "../lib/bingo";
import type { ColorScheme } from "../lib/colorScheme";
import type { FontScheme } from "../lib/fontScheme";

interface CardGridProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
}

/** Steps the per-cell font size down as text length grows, so cells stay a fixed size. */
function fontScaleForText(text: string): number {
  const length = text.length;
  if (length <= 10) return 1;
  if (length <= 16) return 0.85;
  if (length <= 24) return 0.7;
  if (length <= 32) return 0.55;
  return 0.45;
}

export function CardGrid({ card, title, colorScheme, fontScheme }: CardGridProps) {
  return (
    <div
      className="bingo-card"
      style={{
        backgroundColor: colorScheme.backgroundColor,
        color: colorScheme.textColor,
        fontFamily: fontScheme.cellFont,
      }}
    >
      {title && (
        <h3
          className="bingo-card-title"
          style={{ color: colorScheme.titleColor, fontFamily: fontScheme.titleFont }}
        >
          {title}
        </h3>
      )}
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
  );
}
