UPDATE public.legal_documents
SET content_md = REPLACE(content_md, 'ThriftPantry', 'Saver''s Pantry')
WHERE content_md LIKE '%ThriftPantry%';