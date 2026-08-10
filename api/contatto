export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
 
  try {
    const {
      nome,
      cognome,
      email,
      telefono,
      azienda,
      ruolo,
      tipoOrg,
      interesse,
      richiesta,
      privacy1,
      privacy2,
    } = req.body;
 
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_CONTATTI_DB_ID = process.env.NOTION_CONTATTI_DB_ID;
 
    const notionBody = {
      parent: { database_id: NOTION_CONTATTI_DB_ID },
      properties: {
        'Nome':                  { title:        [{ text: { content: nome || '' } }] },
        'Cognome':               { rich_text:    [{ text: { content: cognome || '' } }] },
        'Email':                 { email:        email || null },
        'Telefono':              { phone_number: telefono || null },
        'Azienda':               { rich_text:    [{ text: { content: azienda || '' } }] },
        'Ruolo':                 { rich_text:    [{ text: { content: ruolo || '' } }] },
        'Tu sei':                { select:       tipoOrg ? { name: tipoOrg } : null },
        'Area di interesse':     { select:       interesse ? { name: interesse } : null },
        'Richiesta':             { rich_text:    [{ text: { content: richiesta || '' } }] },
        'Privacy accettata':     { checkbox:     !!privacy1 },
        'Consenso promozionale': { checkbox:     !!privacy2 },
        'Data richiesta':        { date:         { start: new Date().toISOString().split('T')[0] } },
        'Stato':                 { select:       { name: 'Nuovo' } },
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
 
    return res.status(200).json({ success: true });
 
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Errore del server', detail: err.message });
  }
}
