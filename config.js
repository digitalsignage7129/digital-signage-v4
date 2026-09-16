const SUPABASE_URL = "https://ndqqzgbyysehaxwfkiht.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_14ZYGonuOuZDdW2MJkTTTg_LzmCkAbr";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
