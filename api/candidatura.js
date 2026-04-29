import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function uploadToSupabase(filePath, fileName, supabaseUrl, supabaseKey) {
  const fileBuffer = fs.readFileSync(filePath);
  const filePath2 = `cv/${Date.now()}_${fileName}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/cv-docenti/${filePath2}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Supabase upload error: ${err}`);
  }

  // Generate signed URL valid for 1 year (31536000 seconds)
  const signRes = await fetch(`${supabaseUrl}/storage/v1/object/sign/cv-docenti/${filePath2}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 31536000 }),
  });

  if (!signRes.ok) {
    const err = await signRes.text();
    throw new Error(`Supabase sign error: ${err}`);
  }

  const signData = await signRes.json();
  return `${supabaseUrl}/storage/v1${signData.signedURL}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  try {
    const form = new IncomingForm({ keepExtensions: true, maxFileSize: 2 * 1024 * 1024 });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const get = (f) => (Array.isArray(f) ? f[0] : f) || '';

    const nome      = get(fields.nome);
    const cognome   = get(fields.cognome);
    const email     = get(fields.email);
    const telefono  = get(fields.telefono);
    const altroText = get(fields.altro);
    const privacy1  = get(fields.privacy1) === 'true';
    const privacy2  = get(fields.privacy2) === 'true';

    const areeRaw   = fields.aree;
    const areeArray = Array.isArray(areeRaw) ? areeRaw : (areeRaw ? [areeRaw] : []);
    const multiSelect = areeArray.map(a => ({ name: a }));

    const NOTION_TOKEN  = process.env.NOTION_TOKEN;
    const NOTION_DB_ID  = process.env.NOTION_DB_ID;
    const SUPABASE_URL  = process.env.SUPABASE_URL;
    const SUPABASE_KEY  = process.env.SUPABASE_KEY;

    console.log('NOTION_TOKEN starts with:', NOTION_TOKEN ? NOTION_TOKEN.substring(0, 10) : 'UNDEFINED');
    console.log('NOTION_DB_ID:', NOTION_DB_ID ? NOTION_DB_ID.substring(0, 8) : 'UNDEFINED');

    // Upload CV to Supabase
    let cvUrl = '';
    const cvFile = files.cv ? (Array.isArray(files.cv) ? files.cv[0] : files.cv) : null;
    if (cvFile && cvFile.filepath) {
      try {
        const fileName = cvFile.originalFilename || 'cv.pdf';
        cvUrl = await uploadToSupabase(cvFile.filepath, fileName, SUPABASE_URL, SUPABASE_KEY);
      } catch (e) {
        console.error('CV upload error:', e);
      }
    }

    const notionBody = {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        'Nome':                  { title:        [{ text: { content: nome } }] },
        'Cognome':               { rich_text:    [{ text: { content: cognome } }] },
        'Email':                 { email:        email || null },
        'Telefono':              { phone_number: telefono || null },
        'Aree di insegnamento':  { multi_select: multiSelect },
        'Altro (area)':          { rich_text:    [{ text: { content: altroText } }] },
        'Privacy accettata':     { checkbox:     privacy1 },
        'Consenso promozionale': { checkbox:     privacy2 },
        'Data candidatura':      { date:         { start: new Date().toISOString().split('T')[0] } },
        'Stato':                 { select:       { name: 'Nuovo' } },
        ...(cvUrl && { 'CV': { url: cvUrl } }),
      },
    };

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${NOTION_TOKEN}`,
        'Content-Type':   'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(notionBody),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      console.error('Notion error:', err);
      return res.status(500).json({ error: 'Errore Notion', detail: err });
    }

    return res.status(200).json({ success: true, cvUrl });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Errore del server', detail: err.message });
  }
}
