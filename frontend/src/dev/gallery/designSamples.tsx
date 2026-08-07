import { ListChecks } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Samples for the design system and the app shell, as opposed to the card
 * editor's own components, which are in `samples.tsx`.
 */

/**
 * `AppShell` paints a full-bleed background and a sticky header, both of which
 * would otherwise escape a gallery card and cover the page.
 *
 * A transform on an ancestor makes it the containing block for absolutely and
 * fixed positioned descendants, which is what boxes them in here.
 * `translateZ(0)` is the cheapest transform that does it.
 */
function Framed({ children, height = 380 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      style={{ height, transform: "translateZ(0)" }}
      className="relative overflow-y-auto rounded-lg border border-border"
    >
      {children}
    </div>
  );
}

const COLOR_TOKENS = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["destructive", "destructive-foreground"],
  ["warning", "warning-foreground"],
  ["info", "info-foreground"],
  ["paper", "foreground"],
] as const;

/**
 * Every colour token, the radius ladder, the shadow, and the type scale.
 *
 * The point is to see them in *both* presentations: a token that reads well in
 * light and vanishes in dark is the single most common defect in a themed
 * redesign, and nothing mechanical catches it.
 */
export function TokenStrip() {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm font-medium">Colour</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_TOKENS.map(([bg, fg]) => (
            <div
              key={bg}
              // Tailwind needs whole class names at build time, so these are
              // written out rather than composed — `bg-${token}` would produce
              // nothing at all.
              className="rounded-md border border-border p-3 text-xs"
              style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
            >
              <div className="font-medium">--{bg}</div>
              <div className="opacity-70">on --{fg}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          --border and --input are hairlines rather than fills; they outline every box above.
          --ring is the focus colour — tab through the header to see it.
        </p>

        {/* --stamp is ink, not a fill: it colours the border and lettering of a
            passport-stamp chip. Showing it as a filled swatch with text on it
            would be a contrast test for a pairing that never occurs. */}
        <div className="mt-3 inline-flex -rotate-3 items-center rounded-md border-2 border-dashed px-3 py-1 text-xs font-semibold tracking-widest uppercase"
          style={{ borderColor: "var(--stamp)", color: "var(--stamp)" }}
        >
          --stamp
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Radius</p>
        <div className="flex flex-wrap items-end gap-3">
          {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"].map((radius) => (
            <div key={radius} className="text-center text-xs">
              <div className={`size-16 border border-border bg-secondary ${radius}`} />
              <div className="mt-1 text-muted-foreground">{radius}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Depth</p>
        <div className="flex flex-wrap gap-4">
          <div className="shadow-postcard rounded-lg border border-border bg-card p-4 text-xs">
            border + shadow-postcard
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-xs">border only</div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Shadows all but vanish in dark mode. The hairline is what carries structure there — check
          both, and never ship a surface with only a shadow.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Type</p>
        <div className="space-y-1">
          <p className="font-display text-3xl font-semibold tracking-tight">
            Display 3xl — Outfit, headings only
          </p>
          <p className="font-display text-xl font-semibold">Display xl — Outfit</p>
          <p className="text-base">Body base — the system stack</p>
          <p className="text-sm text-muted-foreground">Small muted — captions and helper text</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Perforated edge</p>
        <div className="edge-perf shadow-postcard max-w-sm rounded-lg border border-border bg-paper p-6 text-xs">
          One surface only — the card preview panel, further down this page. Reach for it a second
          time and the answer is no.
        </div>
      </div>
    </div>
  );
}

export function ThemeToggleSample() {
  return (
    <div className="flex items-center gap-3">
      <ThemeToggle />
      <span className="text-sm text-muted-foreground">
        Cycles light → dark → system. Click it; the whole gallery should follow.
      </span>
    </div>
  );
}

export function SiteHeaderSample() {
  return (
    <Framed height={120}>
      <SiteHeader />
    </Framed>
  );
}

export function AppShellSample() {
  return (
    <Framed>
      <AppShell>
        <h1 className="font-display text-2xl font-semibold">Page content</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scroll: the header stays and the background shows through it. The wash, the map grid, and
          the two colour blots are all behind this column.
        </p>
        <div className="mt-4 h-64 rounded-lg border border-border bg-card/60 p-4 text-sm">
          A surface, so the background is visible around it.
        </div>
      </AppShell>
    </Framed>
  );
}

export function PanelSample() {
  return (
    <div className="grid gap-4">
      <Panel
        title="With an action"
        icon={ListChecks}
        actions={
          <Button variant="outline" size="sm">
            Do the thing
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          A group of controls, as a surface. Check this one in dark: the shadow all but disappears
          and the hairline border is what keeps it a distinct panel.
        </p>
      </Panel>
      <Panel title="Without" icon={ListChecks}>
        <p className="text-sm text-muted-foreground">Header, icon, and body.</p>
      </Panel>
    </div>
  );
}
