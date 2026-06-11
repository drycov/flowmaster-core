import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { FileEdit, Save, Bold, Italic, List, ListOrdered, Undo, Redo, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "sonner";
import { getOfficeEditorConfig } from "@/lib/api/office.functions";
import { DocumentOfficeEditor } from "@/components/office/DocumentOfficeEditor";

interface OfficeTabProps {
  documentId: string;
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  isReadOnly?: boolean;
}

export function OfficeTab({
  documentId,
  initialContent = "",
  onSave,
  isReadOnly = false,
}: OfficeTabProps) {
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

  const { data: officeConfig, isLoading: officeLoading } = useQuery({
    queryKey: ["office-config", "document", documentId],
    queryFn: () => getOfficeEditorConfig({ data: { document_id: documentId } }),
    staleTime: 5 * 60 * 1000,
  });

  const officeConfigured = Boolean(officeConfig?.office_url);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: t("doc.contentPlaceholder") })],
    content: initialContent,
    editable: !isReadOnly && !officeConfigured,
    immediatelyRender: false,
  });

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
      toast.success(t("doc.saved"));
    } catch {
      toast.error(t("doc.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (officeLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t("common.loading")}
      </div>
    );
  }

  if (officeConfigured) {
    return <DocumentOfficeEditor documentId={documentId} />;
  }

  return (
    <div className="space-y-4">
      {!isReadOnly && editor && (
        <div className="flex justify-between items-center">
          <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
            <Toggle
              size="sm"
              pressed={editor?.isActive("bold") ?? false}
              onPressedChange={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor}
            >
              <Bold className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("italic") ?? false}
              onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor}
            >
              <Italic className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("bulletList") ?? false}
              onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
              disabled={!editor}
            >
              <List className="w-4 h-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor?.isActive("orderedList") ?? false}
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
            {isSaving ? t("doc.saving") : t("doc.save")}
          </Button>
        </div>
      )}

      <div className="border rounded-md bg-white min-h-[500px] p-4">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>

      <div className="border-2 border-dashed border-border rounded-sm p-4 text-center text-sm text-muted-foreground space-y-2">
        <FileEdit className="w-8 h-8 mx-auto opacity-50" />
        <div className="font-medium text-foreground">{t("doc.officeEditor")}</div>
        <p>{t("office.placeholder")}</p>
      </div>
    </div>
  );
}
