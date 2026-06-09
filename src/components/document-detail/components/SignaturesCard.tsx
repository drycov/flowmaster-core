import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { fmtDate } from "@/lib/format";
import { verifyDocumentSignature } from "@/lib/api/signatures.functions";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Signature } from "../types";

interface SignaturesCardProps {
  signatures: Signature[];
  documentId: string;
}

function parseCertSubject(subject?: string): string {
  if (!subject) return "—";
  const match = subject.match(/CN=([^,]+)/);
  return match ? match[1].trim() : subject;
}

function statusVariant(
  status?: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "valid") return "default";
  if (status === "unverified") return "secondary";
  return "destructive";
}

export function SignaturesCard({ signatures, documentId }: SignaturesCardProps) {
  const { locale, t } = useI18n();
  const qc = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: (signatureId: string) =>
      verifyDocumentSignature({ data: { signature_id: signatureId } }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      const key = `eds.verify.${result.verification_status}` as const;
      toast.success(t(key));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("eds.verify.error")),
  });

  return (
    <Card className="rounded-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {t("doc.signatures")}
          {signatures.length > 0 ? (
            <span className="text-muted-foreground font-normal">({signatures.length})</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signatures.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2 italic text-center">
            {t("doc.noSignatures")}
          </div>
        ) : (
          <div className="space-y-2">
            {signatures.map((s) => {
              const displayName = parseCertSubject(s.cert_subject);
              const status = s.verification_status ?? "unverified";
              const details = s.verification_details;
              const isVerifying =
                verifyMutation.isPending && verifyMutation.variables === s.id;

              return (
                <div
                  key={s.id}
                  className="border border-border rounded-sm p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground break-words max-w-[55%]">
                      {displayName}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                        {s.signature_type}
                      </span>
                      <Badge variant={statusVariant(status)} className="text-[10px] h-5">
                        {status === "valid" ? (
                          <ShieldCheck className="w-3 h-3 mr-1" />
                        ) : status !== "unverified" ? (
                          <ShieldAlert className="w-3 h-3 mr-1" />
                        ) : null}
                        {t(`eds.verify.${status}`)}
                      </Badge>
                    </div>
                  </div>

                  {s.signer_iin ? (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {t("eds.iin")}: {s.signer_iin}
                    </div>
                  ) : null}

                  {s.cert_subject && s.cert_subject.includes("CN=") ? (
                    <div
                      className="text-[11px] text-muted-foreground font-mono truncate mb-1"
                      title={s.cert_subject}
                    >
                      {s.cert_subject}
                    </div>
                  ) : null}

                  {details?.errors?.length ? (
                    <ul className="text-[11px] text-destructive mt-1 space-y-0.5 list-disc pl-4">
                      {details.errors.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="text-[11px] text-muted-foreground flex justify-between items-center mt-2 pt-1.5 border-t border-border/40">
                    <span>{t("doc.signatureStatus")}</span>
                    <span className="font-medium">
                      {s.signed_at ? fmtDate(s.signed_at, locale) : "—"}
                    </span>
                  </div>

                  {s.verified_at ? (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {t("eds.verifiedAt")}: {fmtDate(s.verified_at, locale)}
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs w-full"
                    disabled={isVerifying}
                    onClick={() => verifyMutation.mutate(s.id)}
                  >
                    {isVerifying ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    {t("eds.verify.action")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
