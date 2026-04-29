import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function uploadCV(filePath, originalName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = originalName || path.basename(filePath);

  const response = await fetch(`https://transfer.sh/${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      'Max-Days': '365',
    },
    body: fileBuffer,
  });

  if (!response.ok) throw new Error(`transfer.sh error: ${response.status}`);
  const url = await response.text();
  return url.trim();
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

    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DB_ID = process.env.NOTION_DB_ID;

    // Upload CV
    let cvUrl = '';
    const cvFile = files.cv ? (Array.isArray(files.cv) ? files.cv[0] : files.cv) : null;
    if (cvFile && cvFile.filepath) {
      try {
        cvUrl = await uploadCV(cvFile.filepath, cvFile.originalFilename || 'cv.pdf');
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
        ...(cvUrl && { 'CV': { rich_text: [{ text: { content: cvUrl } }] } }),
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
