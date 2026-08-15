import { useState, type RefObject } from "react";
import { Download, Shuffle, TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth/authContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BingoCard } from "@/lib/bingo";
import type { ColorScheme } from "@/lib/colorScheme";
import { downloadCardPng } from "@/lib/cardPngExport";
import type { EmojiScheme } from "@/lib/emojiScheme";
import type { FontScheme } from "@/lib/fontScheme";
import { CardGrid } from "@/components/CardGrid";

interface CardViewProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
  onRandomize: () => void;
  /** Opens the revocable server-side share dialog. Omitted when accounts are off. */
  onCreateShareLink?: () => void;
  /** True when the user is signed out; the share item becomes a sign-in prompt. */
  shareLinkDisabled?: boolean;
  /**
   * The rendered card's DOM node, owned by the editor so the save flow can
   * generate a thumbnail from it. Also used here for PNG export.
   */
  cardRef: RefObject<HTMLDivElement | null>;
}

export function CardView({
  card,
  title,
  colorScheme,
  fontScheme,
  emojiScheme,
  onRandomize,
  onCreateShareLink,
  shareLinkDisabled,
  cardRef,
}: CardViewProps) {
  const [pngError, setPngError] = useState(false);
  const { signIn } = useAuth();

  function handlePrint() {
    document.fonts.ready.then(() => window.print());
  }

  async function handlePng() {
    const node = cardRef.current;
    if (!node) {
      return;
    }
    setPngError(false);
    try {
      await downloadCardPng(node, title);
    } catch {
      setPngError(true);
    }
  }

  return (
    <section className="card-view">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold">Your card</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRandomize}>
            <Shuffle aria-hidden />
            Randomize card
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Download aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCreateShareLink &&
                (shareLinkDisabled ? (
                  // Previously a disabled item wrapped in a Box so a tooltip
                  // could fire on it — disabled items receive no pointer events,
                  // in Radix as in MUI. An enabled item that does the thing the
                  // user needs next is better than an explanation of why they
                  // cannot have it.
                  <DropdownMenuItem onSelect={() => signIn()}>Sign in to share</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => onCreateShareLink()}>
                    Create share link (short, revocable)
                  </DropdownMenuItem>
                ))}
              <DropdownMenuItem onSelect={() => handlePrint()}>PDF</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handlePng()}>PNG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pngError && (
        <Alert variant="destructive" className="mb-4 max-w-md">
          <TriangleAlert />
          <AlertDescription>
            Sorry, the PNG could not be generated. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/*
        The card preview panel — and the single surface allowed the perforated
        postcard edge (DESIGN.md's one-motif-per-surface rule). Nothing else in
        the app gets `edge-perf`.

        Every `print:` reset here is load-bearing. This element is an ancestor of
        `.bingo-card`, so the print isolation deliberately keeps it — and its
        padding, mask, and shadow would otherwise reach the page. The card is a
        document; the panel it sits on in the app is not part of it.

        `print:block` matters most: on screen this panel is a fixed-width block,
        but the print rule sizes the card with `width: 100%` and the printed
        page is a different width entirely — `print:w-auto` hands that back.

        The width is fixed rather than shrink-to-fit. `.bingo-card` is capped at
        420px but is otherwise as wide as its content, so a panel that hugged it
        grew and shrank with the longest entry — the preview jumped sideways on
        every keystroke. Pinning the panel makes the card a constant 420px, which
        also makes the PNG export a constant size. `max-w-full` so a 390px screen
        still wins. The 2rem is this element's own `p-4`, both sides.
      */}
      <div className="edge-perf w-[calc(420px+2rem)] max-w-full bg-paper p-4 shadow-postcard print:w-auto print:bg-transparent print:p-0 print:shadow-none print:[mask-image:none]">
        <CardGrid
          ref={cardRef}
          card={card}
          title={title}
          colorScheme={colorScheme}
          fontScheme={fontScheme}
          emojiScheme={emojiScheme}
        />
      </div>
    </section>
  );
}
