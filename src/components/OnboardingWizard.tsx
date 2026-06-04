import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n, localized } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Building2,
  Network,
  FolderTree,
  FileText,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Rocket,
} from "lucide-react";
import {
  listDepartments,
  upsertDepartment,
} from "@/lib/api/admin.functions";
import {
  listNomenclature,
  upsertNomenclature,
} from "@/lib/api/nomenclature.functions";
import {
  listTemplates,
  upsertTemplate,
} from "@/lib/api/templates.functions";
import {
  listWorkflows,
  upsertWorkflow,
} from "@/lib/api/workflows.functions";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = "org" | "structure" | "departments" | "nomenclature" | "templates" | "workflows" | "complete";

const STEPS: Step[] = ["org", "structure", "departments", "nomenclature", "templates", "workflows", "complete"];

interface OrgData {
  name_ru: string;
  name_kk: string;
  bin: string;
  address_ru: string;
  address_kk: string;
  head_position_ru: string;
  head_position_kk: string;
  head_name_ru: string;
  head_name_kk: string;
}

interface DepartmentDraft {
  id?: string;
  code: string;
  name_ru: string;
  name_kk: string;
  parent_id: string | null;
}

interface NomenclatureDraft {
  id?: string;
  code: string;
  title_ru: string;
  title_kk: string;
  retention_years: number;
  department_id: string | null;
}

interface TemplateDraft {
  id?: string;
  name_ru: string;
  name_kk: string;
  category: string;
}

interface WorkflowDraft {
  id?: string;
  name_ru: string;
  name_kk: string;
  description: string;
}

export function OnboardingWizard({ open, onOpenChange, onComplete }: OnboardingWizardProps) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>("org");
  
  // Organization data
  const [orgData, setOrgData] = useState<OrgData>({
    name_ru: "",
    name_kk: "",
    bin: "",
    address_ru: "",
    address_kk: "",
    head_position_ru: "",
    head_position_kk: "",
    head_name_ru: "",
    head_name_kk: "",
  });
  
  // Departments data
  const [deptDrafts, setDeptDrafts] = useState<DepartmentDraft[]>([
    { code: "01", name_ru: "Руководство", name_kk: "Басшылық", parent_id: null },
  ]);
  
  // Nomenclature data
  const [nomDrafts, setNomDrafts] = useState<NomenclatureDraft[]>([
    { code: "01-01", title_ru: "Приказы по основной деятельности", title_kk: "Негізгі қызмет бойынша бұйрықтар", retention_years: 10, department_id: null },
  ]);
  
  // Templates data
  const [tplDrafts, setTplDrafts] = useState<TemplateDraft[]>([
    { name_ru: "Служебная записка", name_kk: "Қызметтік жазба", category: "internal" },
  ]);
  
  // Workflows data
  const [wfDrafts, setWfDrafts] = useState<WorkflowDraft[]>([
    { name_ru: "Простое согласование", name_kk: "Қарапайым келісу", description: "Согласование → Подписание → Регистрация" },
  ]);
  
  // Queries
  const { data: existingDepts } = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const { data: existingNom } = useQuery({ queryKey: ["nomenclature"], queryFn: listNomenclature });
  const { data: existingTpl } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const { data: existingWf } = useQuery({ queryKey: ["workflows"], queryFn: listWorkflows });
  
  // Mutations
  const deptMutation = useMutation({
    mutationFn: upsertDepartment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
  
  const nomMutation = useMutation({
    mutationFn: upsertNomenclature,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nomenclature"] }),
  });
  
  const tplMutation = useMutation({
    mutationFn: (data: TemplateDraft) =>
      upsertTemplate({
        data: {
          name_ru: data.name_ru,
          name_kk: data.name_kk,
          category: data.category,
          status: "draft",
          schema: { fields: [], body_template: "" },
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
  
  const wfMutation = useMutation({
    mutationFn: (data: WorkflowDraft) =>
      upsertWorkflow({
        data: {
          name_ru: data.name_ru,
          name_kk: data.name_kk,
          description: data.description,
          status: "draft",
          definition: {
            nodes: [
              { id: "start", type: "START", label: "Начало", position: { x: 50, y: 150 } },
              { id: "approval", type: "APPROVAL", label: "Согласование", position: { x: 200, y: 150 } },
              { id: "sign", type: "SIGNATURE", label: "Подписание", position: { x: 350, y: 150 } },
              { id: "end", type: "END", label: "Конец", position: { x: 500, y: 150 } },
            ],
            edges: [
              { id: "e1", source: "start", target: "approval" },
              { id: "e2", source: "approval", target: "sign" },
              { id: "e3", source: "sign", target: "end" },
            ],
          },
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
  
  const stepIndex = STEPS.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = currentStep === "complete";
  
  const goNext = async () => {
    // Save data for current step before moving
    if (currentStep === "departments") {
      for (const d of deptDrafts) {
        if (d.code && d.name_ru && d.name_kk) {
          await deptMutation.mutateAsync({ data: d });
        }
      }
    } else if (currentStep === "nomenclature") {
      for (const n of nomDrafts) {
        if (n.code && n.title_ru && n.title_kk) {
          await nomMutation.mutateAsync({ data: n });
        }
      }
    } else if (currentStep === "templates") {
      for (const t of tplDrafts) {
        if (t.name_ru && t.name_kk) {
          await tplMutation.mutateAsync(t);
        }
      }
    } else if (currentStep === "workflows") {
      for (const w of wfDrafts) {
        if (w.name_ru && w.name_kk) {
          await wfMutation.mutateAsync(w);
        }
      }
    }
    
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };
  
  const goBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };
  
  const handleComplete = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("edms.onboarding.completed", "true");
    }
    onComplete?.();
    onOpenChange(false);
    setCurrentStep("org");
  };
  
  const t = {
    ru: {
      title: "Мастер настройки системы",
      subtitle: "Пошаговая настройка ЕСЭДО для вашей организации",
      steps: {
        org: "Организация",
        structure: "Оргструктура",
        departments: "Подразделения",
        nomenclature: "Номенклатура",
        templates: "Шаблоны",
        workflows: "Маршруты",
        complete: "Готово",
      },
      next: "Далее",
      back: "Назад",
      skip: "Пропустить",
      finish: "Завершить настройку",
      addItem: "Добавить",
      removeItem: "Удалить",
      org: {
        title: "Данные организации",
        desc: "Укажите основные реквизиты вашей организации",
        name: "Наименование организации",
        bin: "БИН / ИИН",
        address: "Юридический адрес",
        head: "Руководитель организации",
        position: "Должность руководителя",
        headName: "ФИО руководителя",
      },
      structure: {
        title: "Организационная структура",
        desc: "Определите иерархию подразделений вашей организации",
        preview: "Предварительный просмотр структуры",
        tip: "Структура будет создана автоматически на основе подразделений, которые вы добавите на следующем шаге",
      },
      departments: {
        title: "Подразделения",
        desc: "Создайте подразделения (отделы, управления, службы)",
        code: "Код",
        name: "Название",
        parent: "Родительское подразделение",
        noParent: "Верхний уровень",
        existing: "Существующие подразделения",
      },
      nomenclature: {
        title: "Номенклатура дел",
        desc: "Создайте категории для классификации документов",
        code: "Индекс дела",
        name: "Заголовок дела",
        retention: "Срок хранения (лет)",
        dept: "Подразделение",
        allDepts: "Все подразделения",
        existing: "Существующая номенклатура",
      },
      templates: {
        title: "Шаблоны документов",
        desc: "Создайте шаблоны для типовых документов",
        name: "Название шаблона",
        category: "Категория",
        categories: {
          internal: "Внутренние",
          outgoing: "Исходящие",
          incoming: "Входящие",
          contract: "Договоры",
          order: "Приказы",
        },
        existing: "Существующие шаблоны",
      },
      workflows: {
        title: "Маршруты согласования",
        desc: "Создайте типовые маршруты для обработки документов",
        name: "Название маршрута",
        description: "Описание этапов",
        existing: "Существующие маршруты",
      },
      complete: {
        title: "Настройка завершена!",
        desc: "Ваша система готова к работе",
        summary: "Итоги настройки",
        depts: "Подразделений создано",
        nom: "Разделов номенклатуры",
        tpl: "Шаблонов документов",
        wf: "Маршрутов согласования",
        nextSteps: "Следующие шаги",
        step1: "Пригласите сотрудников в систему",
        step2: "Настройте права доступа и роли",
        step3: "Загрузите шаблоны документов (DOCX)",
        step4: "Отредактируйте маршруты в визуальном конструкторе",
      },
    },
    kk: {
      title: "Жүйені баптау шебері",
      subtitle: "Ұйымыңыз үшін БЭҚА-ны қадам-қадам баптау",
      steps: {
        org: "Ұйым",
        structure: "Құрылым",
        departments: "Бөлімдер",
        nomenclature: "Номенклатура",
        templates: "Үлгілер",
        workflows: "Бағыттар",
        complete: "Дайын",
      },
      next: "Келесі",
      back: "Артқа",
      skip: "Өткізіп жіберу",
      finish: "Баптауды аяқтау",
      addItem: "Қосу",
      removeItem: "Жою",
      org: {
        title: "Ұйым деректері",
        desc: "Ұйымыңыздың негізгі деректемелерін көрсетіңіз",
        name: "Ұйым атауы",
        bin: "БСН / ЖСН",
        address: "Заңды мекен-жайы",
        head: "Ұйым басшысы",
        position: "Басшы лауазымы",
        headName: "Басшының аты-жөні",
      },
      structure: {
        title: "Ұйымдық құрылым",
        desc: "Ұйымыңыздың бөлімдер иерархиясын анықтаңыз",
        preview: "Құрылымды алдын ала қарау",
        tip: "Құрылым келесі қадамда қосатын бөлімдер негізінде автоматты түрде жасалады",
      },
      departments: {
        title: "Бөлімдер",
        desc: "Бөлімдер құрыңыз (бөлімдер, басқармалар, қызметтер)",
        code: "Коды",
        name: "Атауы",
        parent: "Басты бөлім",
        noParent: "Жоғарғы деңгей",
        existing: "Бар бөлімдер",
      },
      nomenclature: {
        title: "Істер номенклатурасы",
        desc: "Құжаттарды жіктеу үшін категориялар жасаңыз",
        code: "Іс индексі",
        name: "Іс тақырыбы",
        retention: "Сақтау мерзімі (жыл)",
        dept: "Бөлім",
        allDepts: "Барлық бөлімдер",
        existing: "Бар номенклатура",
      },
      templates: {
        title: "Құжат үлгілері",
        desc: "Үлгі құжаттар үшін шаблондар жасаңыз",
        name: "Үлгі атауы",
        category: "Санат",
        categories: {
          internal: "Ішкі",
          outgoing: "Шығыс",
          incoming: "Кіріс",
          contract: "Шарттар",
          order: "Бұйрықтар",
        },
        existing: "Бар үлгілер",
      },
      workflows: {
        title: "Келісу бағыттары",
        desc: "Құжаттарды өңдеу үшін үлгі бағыттар жасаңыз",
        name: "Бағыт атауы",
        description: "Кезеңдер сипаттамасы",
        existing: "Бар бағыттар",
      },
      complete: {
        title: "Баптау аяқталды!",
        desc: "Жүйеңіз жұмысқа дайын",
        summary: "Баптау нәтижелері",
        depts: "Жасалған бөлімдер",
        nom: "Номенклатура бөлімдері",
        tpl: "Құжат үлгілері",
        wf: "Келісу бағыттары",
        nextSteps: "Келесі қадамдар",
        step1: "Қызметкерлерді жүйеге шақырыңыз",
        step2: "Қол жеткізу құқықтары мен рөлдерді баптаңыз",
        step3: "Құжат үлгілерін жүктеңіз (DOCX)",
        step4: "Бағыттарды көрнекі конструкторда өңдеңіз",
      },
    },
  }[locale];
  
  const stepIcons: Record<Step, typeof Building2> = {
    org: Building2,
    structure: Network,
    departments: FolderTree,
    nomenclature: FileText,
    templates: FileText,
    workflows: GitBranch,
    complete: CheckCircle2,
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        
        {/* Steps indicator */}
        <div className="flex items-center gap-1 py-4 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const Icon = stepIcons[step];
            const isActive = step === currentStep;
            const isPast = idx < stepIndex;
            return (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isPast && "bg-primary/20 text-primary",
                    !isActive && !isPast && "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.steps[step]}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ArrowRight className="w-3 h-3 mx-1 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === "org" && (
            <StepOrganization
              t={t.org}
              locale={locale}
              data={orgData}
              onChange={setOrgData}
            />
          )}
          
          {currentStep === "structure" && (
            <StepStructure
              t={t.structure}
              locale={locale}
              departments={deptDrafts}
            />
          )}
          
          {currentStep === "departments" && (
            <StepDepartments
              t={t.departments}
              locale={locale}
              drafts={deptDrafts}
              onChange={setDeptDrafts}
              existing={existingDepts ?? []}
              addLabel={t.addItem}
              removeLabel={t.removeItem}
            />
          )}
          
          {currentStep === "nomenclature" && (
            <StepNomenclature
              t={t.nomenclature}
              locale={locale}
              drafts={nomDrafts}
              onChange={setNomDrafts}
              existing={existingNom ?? []}
              departments={existingDepts ?? []}
              addLabel={t.addItem}
              removeLabel={t.removeItem}
            />
          )}
          
          {currentStep === "templates" && (
            <StepTemplates
              t={t.templates}
              locale={locale}
              drafts={tplDrafts}
              onChange={setTplDrafts}
              existing={existingTpl ?? []}
              addLabel={t.addItem}
              removeLabel={t.removeItem}
            />
          )}
          
          {currentStep === "workflows" && (
            <StepWorkflows
              t={t.workflows}
              locale={locale}
              drafts={wfDrafts}
              onChange={setWfDrafts}
              existing={existingWf ?? []}
              addLabel={t.addItem}
              removeLabel={t.removeItem}
            />
          )}
          
          {currentStep === "complete" && (
            <StepComplete
              t={t.complete}
              deptCount={(existingDepts?.length ?? 0) + deptDrafts.length}
              nomCount={(existingNom?.length ?? 0) + nomDrafts.length}
              tplCount={(existingTpl?.length ?? 0) + tplDrafts.length}
              wfCount={(existingWf?.length ?? 0) + wfDrafts.length}
            />
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={isFirst}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </Button>
          
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t.skip}
              </Button>
            )}
            
            {isLast ? (
              <Button onClick={handleComplete} className="gap-1.5">
                <Rocket className="w-4 h-4" />
                {t.finish}
              </Button>
            ) : (
              <Button onClick={goNext} className="gap-1.5">
                {t.next}
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Step components
function StepOrganization({
  t,
  locale,
  data,
  onChange,
}: {
  t: any;
  locale: string;
  data: OrgData;
  onChange: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t.name} (RU)</Label>
            <Input
              value={data.name_ru}
              onChange={(e) => onChange({ ...data, name_ru: e.target.value })}
              placeholder="ТОО «Компания»"
            />
          </div>
          <div className="space-y-2">
            <Label>{t.name} (KK)</Label>
            <Input
              value={data.name_kk}
              onChange={(e) => onChange({ ...data, name_kk: e.target.value })}
              placeholder="«Компания» ЖШС"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>{t.bin}</Label>
          <Input
            value={data.bin}
            onChange={(e) => onChange({ ...data, bin: e.target.value })}
            placeholder="123456789012"
            maxLength={12}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t.address} (RU)</Label>
            <Textarea
              value={data.address_ru}
              onChange={(e) => onChange({ ...data, address_ru: e.target.value })}
              placeholder="г. Астана, ул. ..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.address} (KK)</Label>
            <Textarea
              value={data.address_kk}
              onChange={(e) => onChange({ ...data, address_kk: e.target.value })}
              placeholder="Астана қ., ... к-сі"
              rows={2}
            />
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">{t.head}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.position} (RU)</Label>
              <Input
                value={data.head_position_ru}
                onChange={(e) => onChange({ ...data, head_position_ru: e.target.value })}
                placeholder="Генеральный директор"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.position} (KK)</Label>
              <Input
                value={data.head_position_kk}
                onChange={(e) => onChange({ ...data, head_position_kk: e.target.value })}
                placeholder="Бас директор"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.headName} (RU)</Label>
              <Input
                value={data.head_name_ru}
                onChange={(e) => onChange({ ...data, head_name_ru: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.headName} (KK)</Label>
              <Input
                value={data.head_name_kk}
                onChange={(e) => onChange({ ...data, head_name_kk: e.target.value })}
                placeholder="Иванов Иван Иванұлы"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepStructure({
  t,
  locale,
  departments,
}: {
  t: any;
  locale: string;
  departments: DepartmentDraft[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.preview}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {/* Simple org chart preview */}
            <div className="w-48 p-3 bg-primary/10 border border-primary/30 rounded text-center">
              <Building2 className="w-6 h-6 mx-auto mb-1 text-primary" />
              <div className="text-sm font-medium">{locale === "ru" ? "Руководство" : "Басшылық"}</div>
            </div>
            
            <div className="w-px h-6 bg-border" />
            
            <div className="flex flex-wrap justify-center gap-3">
              {departments.slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  className="p-2 bg-muted border border-border rounded text-center min-w-32"
                >
                  <div className="text-xs text-muted-foreground">{d.code}</div>
                  <div className="text-sm">{locale === "ru" ? d.name_ru : d.name_kk}</div>
                </div>
              ))}
              {departments.length > 5 && (
                <div className="p-2 bg-muted border border-border rounded text-center min-w-32">
                  <div className="text-sm text-muted-foreground">+{departments.length - 5}</div>
                </div>
              )}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">{t.tip}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StepDepartments({
  t,
  locale,
  drafts,
  onChange,
  existing,
  addLabel,
  removeLabel,
}: {
  t: any;
  locale: string;
  drafts: DepartmentDraft[];
  onChange: (d: DepartmentDraft[]) => void;
  existing: any[];
  addLabel: string;
  removeLabel: string;
}) {
  const addDraft = () => {
    onChange([
      ...drafts,
      { code: "", name_ru: "", name_kk: "", parent_id: null },
    ]);
  };
  
  const updateDraft = (idx: number, field: keyof DepartmentDraft, value: string | null) => {
    const updated = [...drafts];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };
  
  const removeDraft = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      {existing.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">{t.existing}</h4>
          <div className="flex flex-wrap gap-2">
            {existing.map((d: any) => (
              <Badge key={d.id} variant="secondary">
                {d.code}: {locale === "ru" ? d.name_ru : d.name_kk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {drafts.map((d, idx) => (
          <div key={idx} className="flex items-start gap-2 p-3 bg-muted/50 rounded">
            <div className="grid grid-cols-4 gap-2 flex-1">
              <Input
                value={d.code}
                onChange={(e) => updateDraft(idx, "code", e.target.value)}
                placeholder={t.code}
                className="w-full"
              />
              <Input
                value={d.name_ru}
                onChange={(e) => updateDraft(idx, "name_ru", e.target.value)}
                placeholder={`${t.name} (RU)`}
              />
              <Input
                value={d.name_kk}
                onChange={(e) => updateDraft(idx, "name_kk", e.target.value)}
                placeholder={`${t.name} (KK)`}
              />
              <Select
                value={d.parent_id || "__none__"}
                onValueChange={(v) => updateDraft(idx, "parent_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.parent} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.noParent}</SelectItem>
                  {existing.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.code}: {locale === "ru" ? e.name_ru : e.name_kk}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDraft(idx)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      
      <Button variant="outline" onClick={addDraft} className="gap-1.5">
        <Plus className="w-4 h-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function StepNomenclature({
  t,
  locale,
  drafts,
  onChange,
  existing,
  departments,
  addLabel,
  removeLabel,
}: {
  t: any;
  locale: string;
  drafts: NomenclatureDraft[];
  onChange: (d: NomenclatureDraft[]) => void;
  existing: any[];
  departments: any[];
  addLabel: string;
  removeLabel: string;
}) {
  const addDraft = () => {
    onChange([
      ...drafts,
      { code: "", title_ru: "", title_kk: "", retention_years: 5, department_id: null },
    ]);
  };
  
  const updateDraft = (idx: number, field: keyof NomenclatureDraft, value: any) => {
    const updated = [...drafts];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };
  
  const removeDraft = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      {existing.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">{t.existing}</h4>
          <div className="flex flex-wrap gap-2">
            {existing.map((n: any) => (
              <Badge key={n.id} variant="secondary">
                {n.code}: {locale === "ru" ? n.title_ru : n.title_kk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {drafts.map((d, idx) => (
          <div key={idx} className="flex items-start gap-2 p-3 bg-muted/50 rounded">
            <div className="grid grid-cols-5 gap-2 flex-1">
              <Input
                value={d.code}
                onChange={(e) => updateDraft(idx, "code", e.target.value)}
                placeholder={t.code}
              />
              <Input
                value={d.title_ru}
                onChange={(e) => updateDraft(idx, "title_ru", e.target.value)}
                placeholder={`${t.name} (RU)`}
              />
              <Input
                value={d.title_kk}
                onChange={(e) => updateDraft(idx, "title_kk", e.target.value)}
                placeholder={`${t.name} (KK)`}
              />
              <Input
                type="number"
                value={d.retention_years}
                onChange={(e) => updateDraft(idx, "retention_years", parseInt(e.target.value) || 5)}
                placeholder={t.retention}
                min={1}
                max={75}
              />
              <Select
                value={d.department_id || "__all__"}
                onValueChange={(v) => updateDraft(idx, "department_id", v === "__all__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.dept} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t.allDepts}</SelectItem>
                  {departments.map((dep: any) => (
                    <SelectItem key={dep.id} value={dep.id}>
                      {locale === "ru" ? dep.name_ru : dep.name_kk}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDraft(idx)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      
      <Button variant="outline" onClick={addDraft} className="gap-1.5">
        <Plus className="w-4 h-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function StepTemplates({
  t,
  locale,
  drafts,
  onChange,
  existing,
  addLabel,
  removeLabel,
}: {
  t: any;
  locale: string;
  drafts: TemplateDraft[];
  onChange: (d: TemplateDraft[]) => void;
  existing: any[];
  addLabel: string;
  removeLabel: string;
}) {
  const addDraft = () => {
    onChange([
      ...drafts,
      { name_ru: "", name_kk: "", category: "internal" },
    ]);
  };
  
  const updateDraft = (idx: number, field: keyof TemplateDraft, value: string) => {
    const updated = [...drafts];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };
  
  const removeDraft = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      {existing.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">{t.existing}</h4>
          <div className="flex flex-wrap gap-2">
            {existing.map((tpl: any) => (
              <Badge key={tpl.id} variant="secondary">
                {locale === "ru" ? tpl.name_ru : tpl.name_kk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {drafts.map((d, idx) => (
          <div key={idx} className="flex items-start gap-2 p-3 bg-muted/50 rounded">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <Input
                value={d.name_ru}
                onChange={(e) => updateDraft(idx, "name_ru", e.target.value)}
                placeholder={`${t.name} (RU)`}
              />
              <Input
                value={d.name_kk}
                onChange={(e) => updateDraft(idx, "name_kk", e.target.value)}
                placeholder={`${t.name} (KK)`}
              />
              <Select
                value={d.category}
                onValueChange={(v) => updateDraft(idx, "category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.category} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(t.categories).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDraft(idx)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      
      <Button variant="outline" onClick={addDraft} className="gap-1.5">
        <Plus className="w-4 h-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function StepWorkflows({
  t,
  locale,
  drafts,
  onChange,
  existing,
  addLabel,
  removeLabel,
}: {
  t: any;
  locale: string;
  drafts: WorkflowDraft[];
  onChange: (d: WorkflowDraft[]) => void;
  existing: any[];
  addLabel: string;
  removeLabel: string;
}) {
  const addDraft = () => {
    onChange([
      ...drafts,
      { name_ru: "", name_kk: "", description: "" },
    ]);
  };
  
  const updateDraft = (idx: number, field: keyof WorkflowDraft, value: string) => {
    const updated = [...drafts];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };
  
  const removeDraft = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      
      {existing.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">{t.existing}</h4>
          <div className="flex flex-wrap gap-2">
            {existing.map((wf: any) => (
              <Badge key={wf.id} variant="secondary">
                {locale === "ru" ? wf.name_ru : wf.name_kk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {drafts.map((d, idx) => (
          <div key={idx} className="flex items-start gap-2 p-3 bg-muted/50 rounded">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <Input
                value={d.name_ru}
                onChange={(e) => updateDraft(idx, "name_ru", e.target.value)}
                placeholder={`${t.name} (RU)`}
              />
              <Input
                value={d.name_kk}
                onChange={(e) => updateDraft(idx, "name_kk", e.target.value)}
                placeholder={`${t.name} (KK)`}
              />
              <Input
                value={d.description}
                onChange={(e) => updateDraft(idx, "description", e.target.value)}
                placeholder={t.description}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDraft(idx)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      
      <Button variant="outline" onClick={addDraft} className="gap-1.5">
        <Plus className="w-4 h-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function StepComplete({
  t,
  deptCount,
  nomCount,
  tplCount,
  wfCount,
}: {
  t: any;
  deptCount: number;
  nomCount: number;
  tplCount: number;
  wfCount: number;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
        <CheckCircle2 className="w-8 h-8 text-primary" />
      </div>
      
      <div>
        <h3 className="text-2xl font-semibold">{t.title}</h3>
        <p className="text-muted-foreground mt-1">{t.desc}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.summary}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{deptCount}</div>
              <div className="text-xs text-muted-foreground">{t.depts}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{nomCount}</div>
              <div className="text-xs text-muted-foreground">{t.nom}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{tplCount}</div>
              <div className="text-xs text-muted-foreground">{t.tpl}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{wfCount}</div>
              <div className="text-xs text-muted-foreground">{t.wf}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.nextSteps}</CardTitle>
        </CardHeader>
        <CardContent className="text-left">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t.step1}</li>
            <li>{t.step2}</li>
            <li>{t.step3}</li>
            <li>{t.step4}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
