import { useEffect, useRef, useState } from "react";
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

declare global {
  interface Window {
    DocsAPI?: { DocEditor: (id: string, config: unknown) => void };
  }
}

interface OfficeTabProps {
  documentId: string;
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  isReadOnly?: boolean;
}

function loadOnlyOfficeScript(serverUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("ONLYOFFICE script load failed"));
    document.body.appendChild(script);
  });
}

export function OfficeTab({
  documentId,
  initialContent = "",
  onSave,
  isReadOnly = false,
}: OfficeTabProps) {
  const officeUrl = (import.meta.env.VITE_OFFICE_URL as string | undefined)?.replace(/\/$/, "") || "";
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const ooMounted = useRef(false);

  const { data: officeConfig, isLoading: officeLoading } = useQuery({
    queryKey: ["office-config", documentId],
    queryFn: () => getOfficeEditorConfig({ data: { document_id: documentId } }),
    enabled: !!officeUrl,
    staleTime: 5 * 60 * 1000,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: t("doc.contentPlaceholder") }),
    ],
    content: initialContent,
    editable: !isReadOnly,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (!officeUrl || !officeConfig?.available || !officeConfig.document_server_url) return;
    if (!editorRef.current || ooMounted.current) return;

    let cancelled = false;
    (async () => {
      try {
        await loadOnlyOfficeScript(officeConfig.document_server_url!);
        if (cancelled || !window.DocsAPI) return;
        editorRef.current!.innerHTML = "";
        window.DocsAPI.DocEditor(editorRef.current!, officeConfig.config);
        ooMounted.current = true;
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [officeUrl, officeConfig]);

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

  if (officeUrl) {
    if (officeLoading) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("common.loading")}
        </div>
      );
    }

    if (officeConfig?.available) {
      return (
        <div className="relative">
          <div id="office-editor" ref={editorRef} className="w-full h-[600px]" />
        </div>
      );
    }

    return (
      <div className="border-2 border-dashed border-border rounded-sm p-8 text-center text-sm text-muted-foreground space-y-2">
        <FileEdit className="w-8 h-8 mx-auto opacity-50" />
        <div className="font-medium text-foreground">ONLYOFFICE</div>
        <p>{t("office.noFileVersion")}</p>
        <p className="text-xs">{t("office.placeholder")}</p>
      </div>
    );
  }

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
