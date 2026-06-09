import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

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

import { I18nProvider } from "@/i18n";

import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    void import("@/lib/observability/report-error-browser").then((m) =>
      m.reportClientError(error, { boundary: "tanstack_root_error_component" }),
    );
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Что-то пошло не так
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {import.meta.env.DEV
            ? error.message
            : "Произошла ошибка. Попробуйте позже или обратитесь к администратору."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Повторить
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            На главную
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

      { title: "ЕСЭДО — Единая система электронного документооборота" },

      { name: "description", content: "Enterprise EDMS: документы, маршруты, согласования, ЭЦП." },

      { name: "author", content: "EDMS" },

      { property: "og:title", content: "ЕСЭДО — Единая система электронного документооборота" },

      { name: "twitter:title", content: "ЕСЭДО — Единая система электронного документооборота" },

      {
        property: "og:description",
        content: "Enterprise EDMS: документы, маршруты, согласования, ЭЦП.",
      },

      {
        name: "twitter:description",
        content: "Enterprise EDMS: документы, маршруты, согласования, ЭЦП.",
      },

      {
        property: "og:image",

        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4ccf569a-5724-4fc6-81ad-16bf9b767b17",
      },

      {
        name: "twitter:image",

        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4ccf569a-5724-4fc6-81ad-16bf9b767b17",
      },

      { name: "twitter:card", content: "summary_large_image" },

      { property: "og:type", content: "website" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },

      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },

      { rel: "shortcut icon", href: "/favicon.svg" },

      { rel: "preconnect", href: "https://rsms.me/" },

      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
    ],
  }),

  shellComponent: RootShell,

  component: RootComponent,

  notFoundComponent: NotFoundComponent,

  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
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

function AuthSync() {
  const router = useRouter();

  const qc = useQueryClient();

  useEffect(() => {
    const onAuthChange = () => {
      router.invalidate();

      qc.invalidateQueries();
    };

    window.addEventListener("app-auth-changed", onAuthChange);

    return () => window.removeEventListener("app-auth-changed", onAuthChange);
  }, [router, qc]);

  return null;
}

function SentryInit() {
  useEffect(() => {
    void import("@/lib/observability/sentry-browser").then((m) => m.initSentryClient());
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SentryInit />
        <AuthSync />

        <Outlet />

        <Toaster position="top-right" />
      </I18nProvider>
    </QueryClientProvider>
  );
}
