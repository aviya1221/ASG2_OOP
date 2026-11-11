import type { LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";

/** The size and line width of every icon, so they all look the same (UI decision 17). */
export const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

type Shared = { icon: LucideIcon; label: string };

/** A button that shows only an icon. Its word stays as the hint and for screen readers. */
export function IconButton({ icon: Glyph, label, className = "", ...rest }: Shared & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...rest}>
      <Glyph {...ICON} />
    </button>
  );
}

/** A link inside the product that shows only an icon. */
export function IconLink({ icon: Glyph, label, className = "", ...rest }: Shared & LinkProps) {
  return (
    <Link className={`icon-button ${className}`} aria-label={label} title={label} {...rest}>
      <Glyph {...ICON} />
    </Link>
  );
}

/** A link to a file outside the product that shows only an icon. */
export function IconAnchor({ icon: Glyph, label, className = "", ...rest }: Shared & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`icon-button ${className}`} aria-label={label} title={label} {...rest}>
      <Glyph {...ICON} />
    </a>
  );
}
