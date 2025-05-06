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

// Геокодирование через Яндекс.Карты
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

app.post('/calculate', async (req, res) => {
  console.log('Запрос на расчет:', req.body);  // Логируем запрос, чтобы проверить приходящие данные

  try {
    const body = req.body;

    // Геокодируем точки маршрута, если координаты не переданы
    for (let i = 0; i < body.route_points.length; i++) {
      const point = body.route_points[i];
      if (!point.coordinates && point.address) {
        const coords = await getCoordinates(point.address);
        console.log(`Геокодируем адрес: ${point.address}, полученные координаты:`, coords); // Логируем полученные координаты
        if (!coords) {
          return res.status(400).json({ error: `Не удалось определить координаты для адреса: ${point.address}` });
        }
        point.coordinates = coords;
      }
    }

    // Запрос к Яндекс.Доставке
    const yandexResponse = await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DELIVERY_TOKEN}`
      },
      body: JSON.stringify(body)
    });

    const result = await yandexResponse.json();
    console.log('Ответ от Яндекс.Доставки:', result);  // Логируем результат от Яндекс.Доставки

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
