import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY environment variable is not set');
}

app.post('/api/generate', async (req, res) => {
  try {
    const { system, messages, model, max_tokens, contentBlock } = req.body;

    const payload = {
      model,
      max_tokens,
      system,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: messages[0].content[1].text }]
        }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    };

    if (contentBlock.type === 'document') {
      headers['anthropic-beta'] = 'pdfs-2024-09-25';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
