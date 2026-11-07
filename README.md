# برنامه دورکاری هفتگی

تخصیص یک روز دورکاری در هفته برای ۶ نفر، با تقویم جلالی (شنبه تا چهارشنبه).

## امکانات

- تنظیم **۱ یا ۲ روز** دورکاری برای هر نفر
- تولید تصادفی برای هر هفته
- ویرایش دستی روز(های) هر نفر
- ناوبری بین هفته‌ها
- رمز ساده برای ویرایش (`EDIT_PASSWORD`)

## اجرا محلی

```bash
npm install
npm run dev
```

بدون `DATABASE_URL` داده‌ها فقط در حافظهٔ سرور می‌مانند (با ری‌استارت پاک می‌شوند).

برای ذخیره پایدار، یک دیتابیس رایگان [Neon](https://neon.tech) بسازید و در `.env.local` قرار دهید:

```bash
cp .env.example .env.local
# DATABASE_URL و EDIT_PASSWORD را پر کنید
npm run db:push
npm run dev
```

## دیپلوی روی Vercel (رایگان)

1. ریپو را به [Vercel](https://vercel.com) وصل کنید و Framework را Next.js بگذارید.
2. در Neon یک پروژه رایگان بسازید و connection string را کپی کنید.
3. در Vercel → Settings → Environment Variables:
   - `DATABASE_URL` = همان connection string
   - `EDIT_PASSWORD` = رمزی که تیم برای ویرایش می‌داند
4. یک‌بار migration را اجرا کنید (لوکال با همان `DATABASE_URL`):

```bash
npm run db:push
```

یا SQL داخل `drizzle/0000_init.sql` را در Neon SQL Editor اجرا کنید.

5. Deploy کنید. لینک عمومی فقط خواندنی است مگر با رمز ویرایش.

## افراد

لیست در `src/lib/people.ts` ثابت است؛ برای تغییر نام همان فایل را ویرایش کنید.
