const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Токены
const DELIVERY_TOKEN = 'y0__xDo45fPBxix9Bwg2_D0_BKow1CwQZChNL6oykMqXxFB0ttDKw';
const YANDEX_GEOCODER_API_KEY = 'f408c86b-7d85-41af-a766-fa147dcc6e7c';

// Геокодирование: адрес → координаты + нормализованный адрес
async function getAddressAndCoords(address) {
  const url = `https://geocode-maps.yandex.ru/1.x/?format=json&apikey=${YANDEX_GEOCODER_API_KEY}&geocode=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const geo = data.response.GeoObjectCollection.featureMember[0]?.GeoObject;

    const normalized = geo?.metaDataProperty?.GeocoderMetaData?.Address?.formatted;
    const pos = geo?.Point?.pos;

    if (!normalized || !pos) return null;

    const [lon, lat] = pos.split(' ').map(Number);
    return {
      address: normalized,
      coordinates: [lon, lat]
    };
  } catch (e) {
    console.error('Ошибка геокодирования:', e);
    return null;
  }
}

app.post('/calculate', async (req, res) => {
  try {
    const body = req.body;

    // Обновляем адреса и координаты
    for (let i = 0; i < body.route_points.length; i++) {
      const point = body.route_points[i];
      if (point.address) {
        const resolved = await getAddressAndCoords(point.address);
        if (!resolved) {
          return res.status(400).json({ error: `Не удалось геокодировать адрес: ${point.address}` });
        }
        point.address = resolved.address;
        point.coordinates = resolved.coordinates;
      }
    }

    console.log("Отправляем в Яндекс.Доставку:", JSON.stringify(body, null, 2));

    const yandexResponse = await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DELIVERY_TOKEN}`,
        'Accept-Language': 'ru'
      },
      body: JSON.stringify(body)
    });

    const result = await yandexResponse.json();

    if (!yandexResponse.ok) {
      console.error('Ошибка от Яндекс.Доставки:', result);
      return res.status(yandexResponse.status).json({
        error: 'Ошибка от Яндекс.Доставки',
        details: result
      });
    }

    res.json({
      price: result.price?.amount || null,
      currency: result.price?.currency || 'RUB',
      delivery_time: result.delivery?.delivery_interval || null
    });

  } catch (error) {
    console.error('Ошибка на сервере:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
