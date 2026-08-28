import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./styles.css";

export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    href: "/fonts/DepartureMono-Regular.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let detail = "Reload the page and try again.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Case not found" : "Request failed";
    detail =
      error.status === 404
        ? "Check the link or start a new case."
        : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <main className="error-page">
      <a className="wordmark" href="/">
        BYLINE
      </a>
      <section className="error-panel">
        <p className="eyebrow">Error</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <a className="button button-primary" href="/">
          Start a case
        </a>
      </section>
    </main>
  );
}
