const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/calculate', async (req, res) => {
  try {
    const response = await fetch('https://delivery.yandex.ru/api/delivery-calculator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer y0__xDo45fPBxix9Bwg2_D0_BKow1CwQZChNL6oykMqXxFB0ttDKw'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка на сервере прокси' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
