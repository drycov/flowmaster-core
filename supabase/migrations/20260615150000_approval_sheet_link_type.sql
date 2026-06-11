-- Link type for auto-generated approval sheets (лист согласования)
-- ref_document_link_types uses partial unique (code) WHERE organization_id IS NULL (phase1b)
INSERT INTO public.ref_document_link_types (code, name_ru, name_kk, sort_order, organization_id)
SELECT 'approval_sheet', 'Лист согласования', 'Келісу парағы', 15, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ref_document_link_types
  WHERE code = 'approval_sheet'
    AND organization_id IS NULL
);
