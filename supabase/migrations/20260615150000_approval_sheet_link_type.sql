-- Link type for auto-generated approval sheets (лист согласования)
INSERT INTO public.ref_document_link_types (code, name_ru, name_kk, sort_order)
VALUES ('approval_sheet', 'Лист согласования', 'Келісу парағы', 15)
ON CONFLICT (code) DO NOTHING;
