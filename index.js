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

async function geocodeAddress(address) {
  const apiKey = 'f408c86b-7d85-41af-a766-fa147dcc6e7c'; // Ваш ключ
  const url = `https://geocode-maps.yandex.ru/1.x/?format=json&apikey=${apiKey}&geocode=${encodeURIComponent(address)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.response.GeoObjectCollection.featureMember.length > 0) {
      const pos = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos;
      const [lon, lat] = pos.split(' ').map(Number);
      console.log('Координаты для адреса:', address, [lon, lat]);
    } else {
      console.log('Адрес не найден или некорректен:', address);
    }
  } catch (error) {
    console.error('Ошибка при запросе к геокодеру:', error);
  }
}

geocodeAddress("г. Санкт-Петербург, Серебристый бульвар, 24, к2, кв 636"); // Пример вашего адреса

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
  try {
    const body = req.body;

    // Геокодируем точки маршрута, если координаты не переданы
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

    // Запрос к Яндекс.Доставке с добавленным заголовком Accept-Language
    const yandexResponse = await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DELIVERY_TOKEN}`,
        'Accept-Language': 'ru'  // Добавляем заголовок для языка
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
