import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

const TESTBOOK_FAVICON_URL = "https://testbook.com/assets/img/brand/logo-192x192.png";
const WEBSITE_PREVIEW_IMAGE_URL =
  "https://cdn.testbook.com/1777529381205-ChatGPT%20Image%20Apr%2030%2C%202026%2C%2011_28_26%20AM.png/1777529382.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meera AI By Testbook" },
      { name: "description", content: "Meera by Testbook, your smart AI assistant for instant answers and smarter learning." },
      { name: "author", content: "Testbook" },
      { property: "og:title", content: "Meera AI By Testbook" },
      { property: "og:description", content: "Meera by Testbook, your smart AI assistant for instant answers and smarter learning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Testbook" },
      { name: "twitter:title", content: "Meera AI By Testbook" },
      { name: "twitter:description", content: "Meera by Testbook, your smart AI assistant for instant answers and smarter learning." },
      { property: "og:image", content: WEBSITE_PREVIEW_IMAGE_URL },
      { name: "twitter:image", content: WEBSITE_PREVIEW_IMAGE_URL },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: TESTBOOK_FAVICON_URL,
      },
      {
        rel: "apple-touch-icon",
        sizes: "192x192",
        href: TESTBOOK_FAVICON_URL,
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
