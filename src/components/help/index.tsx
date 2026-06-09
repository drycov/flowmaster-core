import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { HELP_SECTIONS } from "./sections";

export default function HelpPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("help.title")} description={t("help.description")} />

      <PageBody className="max-w-4xl">
        <nav className="mb-8 flex flex-wrap gap-2">
          {HELP_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#help-${section.id}`}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <section.icon className="w-3.5 h-3.5 shrink-0 text-primary" />
              {t(`help.${section.id}.title`)}
            </a>
          ))}
        </nav>

        <Accordion
          type="multiple"
          defaultValue={HELP_SECTIONS.map((s) => s.id)}
          className="rounded-sm border border-border bg-card px-4"
        >
          {HELP_SECTIONS.map((section) => (
            <AccordionItem key={section.id} value={section.id} id={`help-${section.id}`}>
              <AccordionTrigger className="gap-3 hover:no-underline">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                    <section.icon className="h-4 w-4 text-primary" />
                  </span>
                  <span>{t(`help.${section.id}.title`)}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-10 text-muted-foreground">
                  {Array.from({ length: section.paragraphs }, (_, i) => (
                    <p key={i}>{t(`help.${section.id}.p${i + 1}`)}</p>
                  ))}
                  {section.steps ? (
                    <ol className="list-decimal space-y-1.5 pl-4 marker:text-foreground/70">
                      {Array.from({ length: section.steps }, (_, i) => (
                        <li key={i}>{t(`help.${section.id}.step${i + 1}`)}</li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className={cn("mt-6 text-xs text-muted-foreground")}>{t("help.footer")}</p>
      </PageBody>
    </>
  );
}
