export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const {
      nome,
      cognome,
      email,
      telefono,
      aree,
      altro,
      privacy1,
      privacy2,
    } = req.body;

    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DB_ID = process.env.NOTION_DB_ID;

    // Build multi-select options for aree
    const areeArray = Array.isArray(aree) ? aree : (aree ? [aree] : []);
    const multiSelect = areeArray.map(a => ({ name: a }));

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          'Nome': {
            title: [{ text: { content: nome || '' } }],
          },
          'Cognome': {
            rich_text: [{ text: { content: cognome || '' } }],
          },
          'Email': {
            email: email || null,
          },
          'Telefono': {
            phone_number: telefono || null,
          },
          'Aree di insegnamento': {
            multi_select: multiSelect,
          },
          'Altro (area)': {
            rich_text: [{ text: { content: altro || '' } }],
          },
          'Privacy accettata': {
            checkbox: privacy1 === true || privacy1 === 'true',
          },
          'Consenso promozionale': {
            checkbox: privacy2 === true || privacy2 === 'true',
          },
          'Data candidatura': {
            date: { start: new Date().toISOString().split('T')[0] },
          },
          'Stato': {
            select: { name: 'Nuovo' },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion error:', error);
      return res.status(500).json({ error: 'Errore Notion', detail: error });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
}
