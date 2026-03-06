# Kalkulace stavby

Webová aplikace pro kalkulaci nákladů staveb – Jihlava, Třebíč, Znojmo.

---

## 1. Supabase – databáze

1. Přihlaste se na https://supabase.com
2. Otevřete projekt `kalkulace-stavby`
3. Jděte do **SQL Editor** (levý panel)
4. Zkopírujte celý obsah souboru `schema.sql` a spusťte (**Run**)
5. Ověřte: v **Table Editor** by měly být tabulky `profiles` a `stavby`

### Vytvoření prvního admin uživatele
1. Supabase → **Authentication → Users → Add user**
2. Zadejte email + heslo
3. Po vytvoření jděte do **Table Editor → profiles**
4. Najděte uživatele a nastavte `role = admin`, `oblast = Třebíč` (nebo vaše)

---

## 2. GitHub – repozitář

```bash
# Na vašem počítači (nebo přes GitHub web)
git init kalkulace-stavby
cd kalkulace-stavby
# Zkopírujte sem všechny soubory z tohoto balíčku
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VAS_UCET/kalkulace-stavby.git
git push -u origin main
```

---

## 3. Vercel – deployment

1. Přihlaste se na https://vercel.com
2. **Add New Project → Import Git Repository**
3. Vyberte `kalkulace-stavby`
4. Framework: **Next.js** (detekuje automaticky)
5. **Environment Variables** – přidejte:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://khvnaiokxvnbdogaphlw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = váš anon key
6. Klikněte **Deploy**

Po deployi dostanete URL ve tvaru `kalkulace-stavby-xxx.vercel.app`.

---

## 4. Lokální vývoj

```bash
npm install
npm run dev
# Otevřete http://localhost:3000
```

---

## Struktura rolí

| Role  | Co vidí |
|-------|---------|
| admin | Všechny stavby, všechny oblasti |
| user  | Jen své vlastní stavby |

Oblast (Jihlava / Třebíč / Znojmo) se nastavuje v tabulce `profiles`.
