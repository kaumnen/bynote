import type { ReactNode } from "react";
import { Link } from "react-router";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <Link className="wordmark" to="/">
        BYNOTE
      </Link>
      {children ? (
        <div className="site-header-actions">{children}</div>
      ) : null}
    </header>
  );
}
