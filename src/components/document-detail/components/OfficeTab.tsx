// src/components/document-detail/components/OfficeTab.tsx (с TipTap)
import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { FileEdit, Save, Bold, Italic, List, ListOrdered, Undo, Redo } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "sonner";

interface OfficeTabProps {
  documentId: string;
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  isReadOnly?: boolean;
}

export function OfficeTab({ documentId, initialContent = "", onSave, isReadOnly = false }: OfficeTabProps) {
  const officeUrl = (import.meta.env.VITE_OFFICE_URL as string | undefined) || "";
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Начните писать документ...",
      }),
    ],
    content: initialContent,
    editable: !isReadOnly,
    immediatelyRender: false,
  });

  // Обновляем содержимое при изменении initialContent
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  const handleSave = async () => {
    if (!onSave || !editor) return;
    
    setIsSaving(true);
    try {
      await onSave(editor.getHTML());
      toast.success("Документ сохранён");
    } catch (error) {
      toast.error("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  // ONLYOFFICE / MS Office Web
  if (officeUrl) {
    return (
      <div className="relative">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {!isReadOnly && onSave && (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          )}
        </div>
        <iframe
          src={`${officeUrl}?doc=${documentId}`}
          className="w-full h-[600px] border border-border rounded-sm"
          title="Office Editor"
        />
      </div>
    );
  }

  // WYSIWYG редактор (TipTap)
  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="flex justify-between items-center">
          <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
            <Toggle
              size="sm"
              pressed={editor?.isActive("bold")}
              onPressedChange={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor}
            >
              <Bold className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("italic")}
              onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor}
            >
              <Italic className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("bulletList")}
              onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
              disabled={!editor}
            >
              <List className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("orderedList")}
              onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}
              disabled={!editor}
            >
              <ListOrdered className="w-4 h-4" />
            </Toggle>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>

          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      )}

      <div className="border rounded-md bg-white min-h-[500px] p-4">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>

      {!officeUrl && (
        <div className="border-2 border-dashed border-border rounded-sm p-4 text-center text-sm text-muted-foreground space-y-2">
          <FileEdit className="w-8 h-8 mx-auto opacity-50" />
          <div className="font-medium text-foreground">WYSIWYG Редактор</div>
          <p>Редактирование документа во встроенном редакторе</p>
          <p className="text-xs font-mono">document_id = {documentId}</p>
        </div>
      )}
    </div>
  );
}