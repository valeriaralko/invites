/* =====================================================================
   НАЛАШТУВАННЯ САЙТУ: єдиний файл, який треба відредагувати
   Де взяти значення: Supabase → Project Settings → API
   ===================================================================== */
window.APP_CONFIG = {
  /* Project URL, виглядає як https://abcdxyz.supabase.co */
  supabaseUrl: 'https://cvoqlvuimwqrnudcwqoc.supabase.co',
  /* anon public key (довгий рядок, що починається з eyJ...). Його можна показувати публічно:
     дані захищені правилами в schema.sql. НІКОЛИ не вставляйте сюди service_role key. */
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2b3FsdnVpbXdxcm51ZGN3cW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDM1MTEsImV4cCI6MjEwNzQxOTUxMX0.CGOdzYImnulBHuTR3AmUiyqXp5SRzixEZHzD7OHdfC8',
  /* false = оплата не підключена, публікація безкоштовна (тестовий режим) */
  payments: false
};
