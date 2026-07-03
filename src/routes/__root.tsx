import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { FinanceProvider } from "@/lib/finance-store";
import { ProfileProvider } from "@/lib/profile-store";
import { Toaster } from "@/components/ui/sonner";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#080809" },
      { title: "Where's My Budget" },
      {
        name: "description",
        content:
          "L'assistente finanziario intelligente che elimina il lavoro manuale. Voce, foto scontrino, chat AI — zero moduli.",
      },
      { property: "og:title", content: "Where's My Budget" },
      {
        property: "og:description",
        content:
          "Il tuo consulente finanziario personale, ogni giorno. Voce, foto, chat — zero moduli.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Where's My Budget" },
      { name: "description", content: "Your Money Friend is an AI-powered personal finance assistant that simplifies money management through intuitive interaction." },
      { property: "og:description", content: "Your Money Friend is an AI-powered personal finance assistant that simplifies money management through intuitive interaction." },
      { name: "twitter:description", content: "Your Money Friend is an AI-powered personal finance assistant that simplifies money management through intuitive interaction." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gu3OmeRWCZgaB60lDvJ8iYaI9TI3/social-images/social-1783066646288-ChatGPT_Image_3_lug_2026,_10_17_18.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gu3OmeRWCZgaB60lDvJ8iYaI9TI3/social-images/social-1783066646288-ChatGPT_Image_3_lug_2026,_10_17_18.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/__l5e/assets-v1/97279fdc-1094-4289-8849-42c00f372137/wheres-my-budget-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
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
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <FinanceProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster theme="dark" position="top-center" richColors />
        </FinanceProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}
