const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Мидлвары
app.use(cors());
app.use(express.json());

// Эндпоинт для расчета доставки
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

    if (!response.ok) {
      console.error('Ошибка от Яндекс.Доставки:', data);
      return res.status(response.status).json({ error: 'Ошибка при обращении к API Яндекс.Доставки', details: data });
    }

    // Возвращаем клиенту только нужные данные
    res.json({
      price: data.price?.value || null,
      currency: data.price?.currency || 'RUB',
      delivery_time: data.tariff?.deliveryTime || null,
    });
  } catch (error) {
    console.error('Ошибка на сервере:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Старт сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
