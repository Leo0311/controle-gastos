-- Login com Google: conta pode existir sem senha real (login só por Google) e
-- ganha um identificador estável do Google (o "sub" do ID token) para reconhecer
-- o retorno sem depender só do e-mail.
ALTER TABLE usuarios ALTER COLUMN senha DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN google_id VARCHAR(255) UNIQUE;
