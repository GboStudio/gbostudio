/* Configuration publique : aucune clé secrète ici.
   Activez uniquement après création de la table et application de ses politiques RLS.
   Supabase : Settings > API Keys > Publishable key (sb_publishable_...)
*/
window.TEM_MUSEUM_CONFIG = Object.freeze({
  enabled: false,
  supabaseUrl: '',
  publishableKey: '',
  maxResults: 120
});
