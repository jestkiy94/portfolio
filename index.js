const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const DELIVERY_TOKEN = 'y0__xDo45fPBxix9Bwg2_D0_BKow1CwQZChNL6oykMqXxFB0ttDKw';
const YANDEX_GEOCODER_API_KEY = 'f408c86b-7d85-41af-a766-fa147dcc6e7c';

// Геокодирование
async function getCoordinates(address) {
  const url = `https://geocode-maps.yandex.ru/1.x/?format=json&apikey=${YANDEX_GEOCODER_API_KEY}&geocode=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const pos = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos;
    const [lon, lat] = pos.split(' ').map(Number);
    return [lon, lat];
  } catch (e) {
    console.error('Ошибка геокодирования:', e);
    return null;
  }
}

// Попробуем перебрать тарифы
const TARIFFS = [138, 139, 140];

app.post('/calculate', async (req, res) => {
  try {
    const body = req.body;

    // Геокодируем адреса
    for (let i = 0; i < body.route_points.length; i++) {
      const point = body.route_points[i];
      if (!point.coordinates && point.address) {
        const coords = await getCoordinates(point.address);
        if (!coords) {
          return res.status(400).json({ error: `Не удалось определить координаты для адреса: ${point.address}` });
        }
        point.coordinates = coords;
      }
    }

    // Пробуем каждый тариф
    for (let tariff of TARIFFS) {
      const payload = {
        ...body,
        tariff_code: tariff
      };

      const yandexResponse = await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DELIVERY_TOKEN}`,
          'Accept-Language': 'ru'
        },
        body: JSON.stringify(payload)
      });

      const result = await yandexResponse.json();

      if (yandexResponse.ok && result.price) {
        return res.json({
          price: result.price.amount,
          currency: result.price.currency,
          delivery_time: result.delivery?.delivery_interval || null,
          tariff_code: tariff
        });
      } else {
        console.warn(`Тариф ${tariff} не сработал:`, result?.message || result);
      }
    }

    // Если ни один тариф не подошёл
    return res.status(409).json({
      error: 'Нет доступных тарифов в данной зоне'
    });

  } catch (error) {
    console.error('Ошибка на сервере:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
