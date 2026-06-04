import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useI18n, localized } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  FolderTree,
  GitBranch,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UserCircle,
  Loader2,
  Plus,
  ArrowRight,
} from "lucide-react";

import { listDepartments, upsertDepartment } from "@/lib/api/admin.functions";
import { listNomenclature, upsertNomenclature } from "@/lib/api/nomenclature.functions";
import { listTemplates, upsertTemplate } from "@/lib/api/templates.functions";
import { listWorkflows, upsertWorkflow } from "@/lib/api/workflows.functions";
import { completeOnboarding } from "@/lib/api/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingWizard,
});

type Step = "welcome" | "departments" | "nomenclature" | "templates" | "workflows" | "complete";

const STEPS: { id: Step; label: string; labelKk: string; icon: React.ElementType }[] = [
  { id: "welcome", label: "Добро пожаловать", labelKk: "Қош келдіңіз", icon: Sparkles },
  { id: "departments", label: "Подразделения", labelKk: "Бөлімдер", icon: Building2 },
  { id: "nomenclature", label: "Номенклатура", labelKk: "Номенклатура", icon: FolderTree },
  { id: "templates", label: "Шаблоны", labelKk: "Үлгілер", icon: FileText },
  { id: "workflows", label: "Маршруты", labelKk: "Бағыттар", icon: GitBranch },
  { id: "complete", label: "Готово", labelKk: "Дайын", icon: Check },
];

function OnboardingWizard() {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentIndex) / (STEPS.length - 1)) * 100;

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goPrev = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const finishOnboarding = useMutation({
    mutationFn: () => completeOnboarding(),
    onSuccess: () => {
      toast.success(locale === "kk" ? "Онбординг аяқталды!" : "Онбординг завершён!");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">
                  {locale === "kk" ? "Жүйені баптау" : "Настройка системы"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {locale === "kk" ? "Негізгі деректерді құру" : "Создание базовых данных"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              {locale === "kk" ? "Өткізіп жіберу" : "Пропустить"}
            </Button>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <Progress value={progress} className="h-1" />
            <div className="flex justify-between mt-2">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isComplete = idx < currentIndex;
                return (
                  <button
                    key={step.id}
                    onClick={() => idx <= currentIndex && setCurrentStep(step.id)}
                    disabled={idx > currentIndex}
                    className={`flex flex-col items-center gap-1 transition-colors ${
                      isActive ? "text-primary" : isComplete ? "text-primary/60" : "text-muted-foreground/50"
                    } ${idx <= currentIndex ? "cursor-pointer" : "cursor-not-allowed"}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? "bg-primary text-primary-foreground" : 
                      isComplete ? "bg-primary/20 text-primary" : "bg-muted"
                    }`}>
                      {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-[10px] font-medium hidden sm:block">
                      {locale === "kk" ? step.labelKk : step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {currentStep === "welcome" && <WelcomeStep onNext={goNext} locale={locale} />}
        {currentStep === "departments" && <DepartmentsStep onNext={goNext} onPrev={goPrev} locale={locale} />}
        {currentStep === "nomenclature" && <NomenclatureStep onNext={goNext} onPrev={goPrev} locale={locale} />}
        {currentStep === "templates" && <TemplatesStep onNext={goNext} onPrev={goPrev} locale={locale} />}
        {currentStep === "workflows" && <WorkflowsStep onNext={goNext} onPrev={goPrev} locale={locale} />}
        {currentStep === "complete" && (
          <CompleteStep 
            onFinish={() => finishOnboarding.mutate()} 
            isLoading={finishOnboarding.isPending}
            locale={locale} 
          />
        )}
      </div>
    </div>
  );
}

/* ===================== STEP COMPONENTS ===================== */

function WelcomeStep({ onNext, locale }: { onNext: () => void; locale: string }) {
  return (
    <div className="text-center space-y-8 py-12">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold">
          {locale === "kk" ? "Қош келдіңіз!" : "Добро пожаловать!"}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {locale === "kk" 
            ? "Бұл мастер сізге жүйені баптауға көмектеседі: бөлімдер, номенклатура, үлгілер және келісу бағыттарын құру."
            : "Этот мастер поможет вам настроить систему: создать подразделения, номенклатуру дел, шаблоны документов и маршруты согласования."
          }
        </p>
      </div>
      
      <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
        {[
          { icon: Building2, text: locale === "kk" ? "Бөлімдер құрылымы" : "Структура подразделений" },
          { icon: FolderTree, text: locale === "kk" ? "Іс номенклатурасы" : "Номенклатура дел" },
          { icon: FileText, text: locale === "kk" ? "Құжат үлгілері" : "Шаблоны документов" },
          { icon: GitBranch, text: locale === "kk" ? "Келісу бағыттары" : "Маршруты согласования" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Icon className="w-5 h-5 text-primary" />
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onNext} className="gap-2">
        {locale === "kk" ? "Бастау" : "Начать настройку"}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function DepartmentsStep({ onNext, onPrev, locale }: { onNext: () => void; onPrev: () => void; locale: string }) {
  const qc = useQueryClient();
  const { data: departments, isLoading } = useQuery({ queryKey: ["deps"], queryFn: () => listDepartments() });
  const [form, setForm] = useState({ code: "", name_ru: "", name_kk: "" });
  
  const create = useMutation({
    mutationFn: () => upsertDepartment({ data: form }),
    onSuccess: () => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      setForm({ code: "", name_ru: "", name_kk: "" });
      qc.invalidateQueries({ queryKey: ["deps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const presets = [
    { code: "HR", name_ru: "Отдел кадров", name_kk: "Кадрлар бөлімі" },
    { code: "FIN", name_ru: "Финансовый отдел", name_kk: "Қаржы бөлімі" },
    { code: "IT", name_ru: "ИТ-отдел", name_kk: "АТ бөлімі" },
    { code: "LEGAL", name_ru: "Юридический отдел", name_kk: "Заң бөлімі" },
    { code: "ADM", name_ru: "Административный отдел", name_kk: "Әкімшілік бөлім" },
  ];

  const addPreset = (preset: typeof presets[0]) => {
    upsertDepartment({ data: preset }).then(() => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      qc.invalidateQueries({ queryKey: ["deps"] });
    });
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={Building2}
        title={locale === "kk" ? "Бөлімдер құрылымы" : "Структура подразделений"}
        description={locale === "kk" 
          ? "Ұйымыңыздың бөлімдерін құрыңыз. Олар пайдаланушыларға тағайындалады."
          : "Создайте подразделения вашей организации. Они будут использоваться для назначения пользователей."
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "kk" ? "Жаңа бөлім қосу" : "Добавить подразделение"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Код" : "Код"}</Label>
              <Input 
                value={form.code} 
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="HR, FIN, IT..."
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (RU)" : "Название (RU)"}</Label>
              <Input 
                value={form.name_ru} 
                onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                placeholder="Отдел кадров"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (KK)" : "Название (KK)"}</Label>
              <Input 
                value={form.name_kk} 
                onChange={(e) => setForm((f) => ({ ...f, name_kk: e.target.value }))}
                placeholder="Кадрлар бөлімі"
              />
            </div>
            <Button 
              onClick={() => create.mutate()} 
              disabled={create.isPending || !form.code || !form.name_ru}
              className="w-full"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {locale === "kk" ? "Қосу" : "Добавить"}
            </Button>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                {locale === "kk" ? "Жылдам қосу:" : "Быстрое добавление:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button 
                    key={preset.code} 
                    variant="outline" 
                    size="sm"
                    onClick={() => addPreset(preset)}
                    disabled={(departments ?? []).some((d) => d.code === preset.code)}
                  >
                    {preset.code}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{locale === "kk" ? "Құрылған бөлімдер" : "Созданные подразделения"}</span>
              <Badge variant="secondary">{(departments ?? []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (departments ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {locale === "kk" ? "Әлі бөлімдер жоқ" : "Пока нет подразделений"}
              </div>
            ) : (
              <div className="space-y-2">
                {(departments ?? []).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Building2 className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {localized(d, locale as "ru" | "kk", "name")}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{d.code}</div>
                    </div>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StepNavigation onPrev={onPrev} onNext={onNext} locale={locale} />
    </div>
  );
}

function NomenclatureStep({ onNext, onPrev, locale }: { onNext: () => void; onPrev: () => void; locale: string }) {
  const qc = useQueryClient();
  const { data: nomenclature, isLoading } = useQuery({ queryKey: ["nom"], queryFn: () => listNomenclature() });
  const [form, setForm] = useState({ code: "", title_ru: "", title_kk: "", retention: 5 });
  
  const create = useMutation({
    mutationFn: () => upsertNomenclature({ 
      data: {
        parent_id: null,
        code: form.code,
        title_ru: form.title_ru,
        title_kk: form.title_kk,
        retention_years: form.retention,
        archive_rule: "standard",
      }
    }),
    onSuccess: () => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      setForm({ code: "", title_ru: "", title_kk: "", retention: 5 });
      qc.invalidateQueries({ queryKey: ["nom"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const presets = [
    { code: "01", title_ru: "Организационно-распорядительные документы", title_kk: "Ұйымдастырушылық-өкімдік құжаттар", retention: 75 },
    { code: "02", title_ru: "Планово-отчетная документация", title_kk: "Жоспарлау-есептік құжаттама", retention: 5 },
    { code: "03", title_ru: "Кадровая документация", title_kk: "Кадрлық құжаттама", retention: 75 },
    { code: "04", title_ru: "Финансовая документация", title_kk: "Қаржылық құжаттама", retention: 5 },
    { code: "05", title_ru: "Договорная документация", title_kk: "Шарттық құжаттама", retention: 5 },
  ];

  const addPreset = (preset: typeof presets[0]) => {
    upsertNomenclature({ 
      data: { parent_id: null, ...preset, archive_rule: "standard", retention_years: preset.retention }
    }).then(() => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      qc.invalidateQueries({ queryKey: ["nom"] });
    });
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={FolderTree}
        title={locale === "kk" ? "Іс номенклатурасы" : "Номенклатура дел"}
        description={locale === "kk" 
          ? "Құжаттарды жіктеу мен мұрағаттау үшін номенклатура разделдерін құрыңыз."
          : "Создайте разделы номенклатуры для классификации и архивирования документов."
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "kk" ? "Жаңа раздел қосу" : "Добавить раздел"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Код" : "Код"}</Label>
              <Input 
                value={form.code} 
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="01, 02, 01-01..."
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (RU)" : "Название (RU)"}</Label>
              <Input 
                value={form.title_ru} 
                onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (KK)" : "Название (KK)"}</Label>
              <Input 
                value={form.title_kk} 
                onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Сақтау мерзімі (жыл)" : "Срок хранения (лет)"}</Label>
              <Input 
                type="number"
                value={form.retention} 
                onChange={(e) => setForm((f) => ({ ...f, retention: Number(e.target.value) }))}
              />
            </div>
            <Button 
              onClick={() => create.mutate()} 
              disabled={create.isPending || !form.code || !form.title_ru}
              className="w-full"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {locale === "kk" ? "Қосу" : "Добавить"}
            </Button>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                {locale === "kk" ? "Типтік разделдер:" : "Типовые разделы:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button 
                    key={preset.code} 
                    variant="outline" 
                    size="sm"
                    onClick={() => addPreset(preset)}
                    disabled={(nomenclature ?? []).some((n) => n.code === preset.code)}
                  >
                    {preset.code}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{locale === "kk" ? "Құрылған разделдер" : "Созданные разделы"}</span>
              <Badge variant="secondary">{(nomenclature ?? []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (nomenclature ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {locale === "kk" ? "Әлі разделдер жоқ" : "Пока нет разделов"}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(nomenclature ?? []).map((n) => (
                  <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <FolderTree className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {localized(n, locale as "ru" | "kk", "title")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{n.code}</span>
                        <span className="mx-1">·</span>
                        <span>{n.retention_years} {locale === "kk" ? "жыл" : "лет"}</span>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StepNavigation onPrev={onPrev} onNext={onNext} locale={locale} />
    </div>
  );
}

function TemplatesStep({ onNext, onPrev, locale }: { onNext: () => void; onPrev: () => void; locale: string }) {
  const qc = useQueryClient();
  const { data: templates, isLoading } = useQuery({ queryKey: ["tpls"], queryFn: () => listTemplates() });
  const [form, setForm] = useState({ name_ru: "", name_kk: "", category: "general" });
  
  const create = useMutation({
    mutationFn: () => upsertTemplate({ 
      data: {
        name_ru: form.name_ru,
        name_kk: form.name_kk,
        category: form.category,
        status: "draft",
        schema: { 
          fields: [
            { id: "recipient", type: "text", label: "Получатель", required: true },
            { id: "subject", type: "text", label: "Тема", required: true },
          ], 
          body_template: "{{recipient}}\n\n{{subject}}\n\n[Содержание документа]" 
        },
      }
    }),
    onSuccess: () => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      setForm({ name_ru: "", name_kk: "", category: "general" });
      qc.invalidateQueries({ queryKey: ["tpls"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const presets = [
    { name_ru: "Служебная записка", name_kk: "Қызметтік жазба", category: "internal" },
    { name_ru: "Приказ", name_kk: "Бұйрық", category: "order" },
    { name_ru: "Договор", name_kk: "Шарт", category: "contract" },
    { name_ru: "Акт", name_kk: "Акт", category: "act" },
    { name_ru: "Заявление", name_kk: "Өтініш", category: "application" },
  ];

  const addPreset = (preset: typeof presets[0]) => {
    upsertTemplate({ 
      data: {
        ...preset,
        status: "draft",
        schema: { 
          fields: [
            { id: "recipient", type: "text", label: "Получатель", required: true },
            { id: "subject", type: "text", label: "Тема", required: true },
          ], 
          body_template: "{{recipient}}\n\n{{subject}}\n\n[Содержание документа]" 
        },
      }
    }).then(() => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      qc.invalidateQueries({ queryKey: ["tpls"] });
    });
  };

  const categories = [
    { value: "general", label: locale === "kk" ? "Жалпы" : "Общий" },
    { value: "internal", label: locale === "kk" ? "Ішкі" : "Внутренний" },
    { value: "order", label: locale === "kk" ? "Бұйрық" : "Приказ" },
    { value: "contract", label: locale === "kk" ? "Шарт" : "Договор" },
    { value: "act", label: locale === "kk" ? "Акт" : "Акт" },
    { value: "application", label: locale === "kk" ? "Өтініш" : "Заявление" },
  ];

  return (
    <div className="space-y-6">
      <StepHeader
        icon={FileText}
        title={locale === "kk" ? "Құжат үлгілері" : "Шаблоны документов"}
        description={locale === "kk" 
          ? "Жиі қолданылатын құжат үлгілерін құрыңыз."
          : "Создайте шаблоны для часто используемых типов документов."
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "kk" ? "Жаңа үлгі қосу" : "Добавить шаблон"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (RU)" : "Название (RU)"}</Label>
              <Input 
                value={form.name_ru} 
                onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                placeholder="Служебная записка"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (KK)" : "Название (KK)"}</Label>
              <Input 
                value={form.name_kk} 
                onChange={(e) => setForm((f) => ({ ...f, name_kk: e.target.value }))}
                placeholder="Қызметтік жазба"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Санат" : "Категория"}</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => create.mutate()} 
              disabled={create.isPending || !form.name_ru}
              className="w-full"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {locale === "kk" ? "Қосу" : "Добавить"}
            </Button>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                {locale === "kk" ? "Типтік үлгілер:" : "Типовые шаблоны:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button 
                    key={preset.name_ru} 
                    variant="outline" 
                    size="sm"
                    onClick={() => addPreset(preset)}
                    disabled={(templates ?? []).some((t) => t.name_ru === preset.name_ru)}
                  >
                    {locale === "kk" ? preset.name_kk : preset.name_ru}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{locale === "kk" ? "Құрылған үлгілер" : "Созданные шаблоны"}</span>
              <Badge variant="secondary">{(templates ?? []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (templates ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {locale === "kk" ? "Әлі үлгілер жоқ" : "Пока нет шаблонов"}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(templates ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <FileText className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {localized(t, locale as "ru" | "kk", "name")}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.category}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StepNavigation onPrev={onPrev} onNext={onNext} locale={locale} />
    </div>
  );
}

function WorkflowsStep({ onNext, onPrev, locale }: { onNext: () => void; onPrev: () => void; locale: string }) {
  const qc = useQueryClient();
  const { data: workflows, isLoading } = useQuery({ queryKey: ["wfs"], queryFn: () => listWorkflows() });
  const [form, setForm] = useState({ name_ru: "", name_kk: "", description: "" });
  
  const create = useMutation({
    mutationFn: () => upsertWorkflow({ 
      data: {
        name_ru: form.name_ru,
        name_kk: form.name_kk,
        description: form.description,
        status: "draft",
        definition: {
          nodes: [
            { id: "start", type: "START", label: "Начало", position: { x: 50, y: 100 } },
            { id: "approve1", type: "APPROVAL", label: "Согласование", position: { x: 250, y: 100 } },
            { id: "end", type: "END", label: "Конец", position: { x: 450, y: 100 } },
          ],
          edges: [
            { id: "e1", source: "start", target: "approve1" },
            { id: "e2", source: "approve1", target: "end" },
          ],
        },
      }
    }),
    onSuccess: () => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      setForm({ name_ru: "", name_kk: "", description: "" });
      qc.invalidateQueries({ queryKey: ["wfs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const presets = [
    { 
      name_ru: "Простое согласование", 
      name_kk: "Қарапайым келісу", 
      description: "Один этап согласования",
      definition: {
        nodes: [
          { id: "start", type: "START", label: "Начало", position: { x: 50, y: 100 } },
          { id: "approve1", type: "APPROVAL", label: "Согласование", position: { x: 250, y: 100 } },
          { id: "end", type: "END", label: "Конец", position: { x: 450, y: 100 } },
        ],
        edges: [
          { id: "e1", source: "start", target: "approve1" },
          { id: "e2", source: "approve1", target: "end" },
        ],
      }
    },
    { 
      name_ru: "Двухуровневое согласование", 
      name_kk: "Екі деңгейлі келісу", 
      description: "Согласование начальником и директором",
      definition: {
        nodes: [
          { id: "start", type: "START", label: "Начало", position: { x: 50, y: 100 } },
          { id: "approve1", type: "APPROVAL", label: "Начальник отдела", position: { x: 200, y: 100 } },
          { id: "approve2", type: "APPROVAL", label: "Директор", position: { x: 350, y: 100 } },
          { id: "end", type: "END", label: "Конец", position: { x: 500, y: 100 } },
        ],
        edges: [
          { id: "e1", source: "start", target: "approve1" },
          { id: "e2", source: "approve1", target: "approve2" },
          { id: "e3", source: "approve2", target: "end" },
        ],
      }
    },
    { 
      name_ru: "Согласование с подписью", 
      name_kk: "Қол қоюмен келісу", 
      description: "Согласование и ЭЦП",
      definition: {
        nodes: [
          { id: "start", type: "START", label: "Начало", position: { x: 50, y: 100 } },
          { id: "approve1", type: "APPROVAL", label: "Согласование", position: { x: 200, y: 100 } },
          { id: "sign", type: "SIGNATURE", label: "Подпись ЭЦП", position: { x: 350, y: 100 } },
          { id: "end", type: "END", label: "Конец", position: { x: 500, y: 100 } },
        ],
        edges: [
          { id: "e1", source: "start", target: "approve1" },
          { id: "e2", source: "approve1", target: "sign" },
          { id: "e3", source: "sign", target: "end" },
        ],
      }
    },
  ];

  const addPreset = (preset: typeof presets[0]) => {
    upsertWorkflow({ 
      data: {
        name_ru: preset.name_ru,
        name_kk: preset.name_kk,
        description: preset.description,
        status: "draft",
        definition: preset.definition,
      }
    }).then(() => {
      toast.success(locale === "kk" ? "Қосылды" : "Добавлено");
      qc.invalidateQueries({ queryKey: ["wfs"] });
    });
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={GitBranch}
        title={locale === "kk" ? "Келісу бағыттары" : "Маршруты согласования"}
        description={locale === "kk" 
          ? "Құжаттардың келісу бағыттарын құрыңыз. Оларды кейін визуалды редакторда баптауға болады."
          : "Создайте маршруты согласования документов. Их можно будет настроить позже в визуальном редакторе."
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "kk" ? "Жаңа бағыт қосу" : "Добавить маршрут"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (RU)" : "Название (RU)"}</Label>
              <Input 
                value={form.name_ru} 
                onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                placeholder="Согласование договоров"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Атауы (KK)" : "Название (KK)"}</Label>
              <Input 
                value={form.name_kk} 
                onChange={(e) => setForm((f) => ({ ...f, name_kk: e.target.value }))}
                placeholder="Шарттарды келісу"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === "kk" ? "Сипаттамасы" : "Описание"}</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={locale === "kk" ? "Қысқаша сипаттама..." : "Краткое описание..."}
                rows={2}
              />
            </div>
            <Button 
              onClick={() => create.mutate()} 
              disabled={create.isPending || !form.name_ru}
              className="w-full"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {locale === "kk" ? "Қосу" : "Добавить"}
            </Button>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                {locale === "kk" ? "Типтік бағыттар:" : "Типовые маршруты:"}
              </p>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <Button 
                    key={preset.name_ru} 
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => addPreset(preset)}
                    disabled={(workflows ?? []).some((w) => w.name_ru === preset.name_ru)}
                  >
                    <GitBranch className="w-4 h-4 mr-2" />
                    {locale === "kk" ? preset.name_kk : preset.name_ru}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{locale === "kk" ? "Құрылған бағыттар" : "Созданные маршруты"}</span>
              <Badge variant="secondary">{(workflows ?? []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (workflows ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {locale === "kk" ? "Әлі бағыттар жоқ" : "Пока нет маршрутов"}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(workflows ?? []).map((w) => (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {localized(w, locale as "ru" | "kk", "name")}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {w.description || "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{w.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StepNavigation onPrev={onPrev} onNext={onNext} locale={locale} />
    </div>
  );
}

function CompleteStep({ onFinish, isLoading, locale }: { onFinish: () => void; isLoading: boolean; locale: string }) {
  return (
    <div className="text-center space-y-8 py-12">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold">
          {locale === "kk" ? "Барлығы дайын!" : "Всё готово!"}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {locale === "kk" 
            ? "Жүйе баптауы аяқталды. Енді құжаттармен жұмыс істеуге болады."
            : "Базовая настройка системы завершена. Теперь вы можете приступить к работе с документами."
          }
        </p>
      </div>
      
      <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
        {[
          { icon: FileText, text: locale === "kk" ? "Құжат құру" : "Создать документ" },
          { icon: GitBranch, text: locale === "kk" ? "Бағыттарды баптау" : "Настроить маршруты" },
          { icon: UserCircle, text: locale === "kk" ? "Профильді толтыру" : "Заполнить профиль" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Icon className="w-5 h-5 text-primary" />
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onFinish} disabled={isLoading} className="gap-2">
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {locale === "kk" ? "Күте тұрыңыз..." : "Подождите..."}
          </>
        ) : (
          <>
            {locale === "kk" ? "Жүйеге өту" : "Перейти к работе"}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}

/* ===================== HELPER COMPONENTS ===================== */

function StepHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
    </div>
  );
}

function StepNavigation({ onPrev, onNext, locale }: { onPrev: () => void; onNext: () => void; locale: string }) {
  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <Button variant="outline" onClick={onPrev} className="gap-2">
        <ChevronLeft className="w-4 h-4" />
        {locale === "kk" ? "Артқа" : "Назад"}
      </Button>
      <Button onClick={onNext} className="gap-2">
        {locale === "kk" ? "Жалғастыру" : "Продолжить"}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
