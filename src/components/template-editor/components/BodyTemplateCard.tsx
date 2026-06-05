// src/components/template-editor/components/BodyTemplateCard.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  Bold, Italic, List, ListOrdered, Code, Undo, Redo,
  Eye, EyeOff, Maximize2, Minimize2, HelpCircle, Plus,
  User, Calendar, Building2, Hash, FileText, Briefcase,
  Signature, File,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BodyTemplateCardProps {
  body: string;
  onBodyChange: (value: string) => void;
}

// Предустановленные поля с иконками из lucide-react
const PRESET_PLACEHOLDERS = [
  { key: "full_name", label: "ФИО сотрудника", icon: User },
  { key: "document_date", label: "Дата документа", icon: Calendar },
  { key: "department", label: "Название отдела", icon: Building2 },
  { key: "registration_number", label: "Регистрационный номер", icon: Hash },
  { key: "document_title", label: "Название документа", icon: FileText },
  { key: "responsible_person", label: "Ответственный", icon: Briefcase },
  { key: "signature_name", label: "Подпись", icon: Signature },
  { key: "content_body", label: "Основное содержание", icon: File },
];

export function BodyTemplateCard({ body, onBodyChange }: BodyTemplateCardProps) {
  const { t } = useI18n();
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: {
          HTMLAttributes: {
            class: "bg-yellow-50 text-amber-700 px-1 py-0.5 rounded font-mono text-xs border border-yellow-300",
          },
        },
      }),
      Placeholder.configure({
        placeholder: "Напишите текст шаблона... Используйте {{ключ_поля}} для подстановки значений",
      }),
    ],
    content: body,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none h-full p-4",
      },
    },
    onUpdate: ({ editor }) => {
      onBodyChange(editor.getHTML());
    },
  });

  // Синхронизация внешнего контента
  useEffect(() => {
    if (editor && body !== editor.getHTML()) {
      editor.commands.setContent(body);
    }
  }, [editor, body]);

  // Обработка Escape для выхода из полноэкранного режима
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  const insertPlaceholder = useCallback((key: string) => {
    if (editor) {
      editor.commands.insertContent(`{{${key}}}`);
      editor.commands.focus();
    }
  }, [editor]);

  const insertCustomPlaceholder = useCallback(() => {
    const key = prompt("Введите ключ поля (например: full_name, document_date, etc.)");
    if (key && editor) {
      insertPlaceholder(key);
    }
  }, [editor, insertPlaceholder]);

  if (!editor) {
    return null;
  }

  const fullscreenClass = isFullscreen
    ? "fixed inset-0 z-50 m-0 rounded-none"
    : "h-full";

  return (
    <TooltipProvider>
      <div ref={cardRef} className={fullscreenClass}>
        <Card className="rounded-sm h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between shrink-0">
            <CardTitle className="text-sm">{t("doc.body")}</CardTitle>
            <div className="flex gap-1">
              {/* Выпадающее меню с предустановленными полями - ширина по контенту */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    <Plus className="w-3 h-3 mr-1" />
                    Вставить поле
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="min-w-[auto] w-auto"
                  sideOffset={5}
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Предустановленные поля
                  </div>
                  <DropdownMenuSeparator />
                  {PRESET_PLACEHOLDERS.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.key}
                        onClick={() => insertPlaceholder(item.key)}
                        className="cursor-pointer whitespace-nowrap"
                      >
                        <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="flex-1 mr-4">{item.label}</span>
                        <code className="text-xs text-muted-foreground">{`{{${item.key}}}`}</code>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={insertCustomPlaceholder} 
                    className="cursor-pointer whitespace-nowrap"
                  >
                    <Code className="w-3 h-3 mr-2" />
                    <span>Свой ключ...</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-xs h-8"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Показать/скрыть подсказки</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPlaceholders(!showPlaceholders)}
                    className="text-xs h-8"
                  >
                    {showPlaceholders ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showPlaceholders ? "Скрыть подсказки" : "Показать подсказки"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="text-xs h-8"
                  >
                    {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullscreen ? "Выход из полноэкранного режима" : "Полноэкранный режим"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0">
            {/* Панель инструментов */}
            <div className="flex gap-1 border rounded-md p-1 bg-muted/30 flex-wrap mb-3 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={editor.isActive("bold")}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                  >
                    <Bold className="w-4 h-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Жирный</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={editor.isActive("italic")}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                  >
                    <Italic className="w-4 h-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Курсив</TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={editor.isActive("bulletList")}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                  >
                    <List className="w-4 h-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Маркированный список</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={editor.isActive("orderedList")}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                  >
                    <ListOrdered className="w-4 h-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Нумерованный список</TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="h-8 w-8 p-0"
                  >
                    <Undo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Отменить</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="h-8 w-8 p-0"
                  >
                    <Redo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Повторить</TooltipContent>
              </Tooltip>
            </div>

            {/* Подсказка о placeholder */}
            {showPlaceholders && showHelp && (
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-2 rounded-md mb-3 shrink-0">
                <p className="font-medium text-blue-800 mb-1">📌 Как использовать поля:</p>
                <p className="mb-1">
                  <span className="font-mono text-primary bg-yellow-50 px-1 rounded">{"{{ключ_поля}}"}</span> — будут заменены на значения при создании документа
                </p>
                <p className="text-xs">Вы можете вставить поле через кнопку <strong>"Вставить поле"</strong> или написать вручную</p>
              </div>
            )}

            {/* WYSIWYG редактор */}
            <div className={`flex-1 border rounded-md bg-white overflow-auto ${!showPlaceholders ? "opacity-70" : ""}`}>
              <EditorContent editor={editor} className="h-full" />
            </div>

            {/* Примеры доступных полей */}
            {showPlaceholders && showHelp && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 mt-3 shrink-0">
                <p className="font-medium mb-2">🔧 Популярные поля для подстановки:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_PLACEHOLDERS.slice(0, 4).map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <div key={item.key} className="flex items-center gap-2">
                        <IconComponent className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <code className="text-xs bg-muted px-1 rounded font-mono">
                          {`{{${item.key}}}`}
                        </code>
                        <span className="text-muted-foreground truncate">→ {item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}