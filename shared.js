// --- Conexão com o Supabase (compartilhada entre as páginas do site) ---
const SUPABASE_URL = 'https://eosxiwmkwbvfjhebhxud.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Toy-wRW1IXRtA-BNKa4dkg_dWzoT1XV';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
