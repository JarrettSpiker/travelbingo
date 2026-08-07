import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * `clsx` flattens conditionals; `twMerge` then resolves conflicts within a
 * utility group, so a caller passing `className="px-6"` to a component whose
 * default is `px-4` gets `px-6` rather than both and a coin toss on source
 * order. Every shadcn component expects this function at this path — it is
 * named in components.json.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
