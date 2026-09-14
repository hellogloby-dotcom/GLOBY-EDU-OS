const { createClient } = require('@supabase/supabase-js');

const SUPABASE_BUCKET = 'school-files';
let supabaseClient = null;

function getSupabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').trim(),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  };
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.');
  }

  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

async function uploadSchoolFile(filePath, file, options = {}) {
  const { error } = await getSupabaseClient()
    .storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file, {
      contentType: options.contentType,
      upsert: options.upsert === true,
    });

  if (error) throw error;
  return filePath;
}

async function createSchoolFileSignedUrl(filePath, expiresIn = 3600) {
  const { data, error } = await getSupabaseClient()
    .storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

async function downloadSchoolFile(filePath) {
  const { data, error } = await getSupabaseClient()
    .storage
    .from(SUPABASE_BUCKET)
    .download(filePath);

  if (error) throw error;
  return data;
}

module.exports = {
  SUPABASE_BUCKET,
  getSupabaseClient,
  uploadSchoolFile,
  createSchoolFileSignedUrl,
  downloadSchoolFile,
};
