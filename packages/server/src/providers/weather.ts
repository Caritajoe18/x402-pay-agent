import type { Provider } from "./types.js";

/**
 * Real-time weather data from Open-Meteo (free, no API key needed).
 * https://open-meteo.com/en/docs
 */
export const weatherProvider: Provider = {
  slug: "weather",
  name: "Weather Data",
  description: "Real-time weather data for any city worldwide",
  price: "$0.0001",
  params: [
    {
      name: "city",
      description: "City name (e.g. 'Tokyo', 'New York', 'London')",
      required: true,
    },
    {
      name: "units",
      description: "Temperature units: 'celsius' or 'fahrenheit' (default: celsius)",
      required: false,
      default: "celsius",
    },
  ],

  async fetch(params) {
    const city = params.city || "London";
    const units = params.units || "celsius";

    // Geocode city name to coordinates
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`;
    const geoRes = await fetch(geoUrl);
    const geoData = (await geoRes.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string; country: string }>;
    };

    if (!geoData.results || geoData.results.length === 0) {
      return { error: `City "${city}" not found` };
    }

    const loc = geoData.results[0];

    // Fetch current weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=${units === "fahrenheit" ? "fahrenheit" : "celsius"}`;
    const weatherRes = await fetch(weatherUrl);
    const weather = (await weatherRes.json()) as {
      current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
      };
    };

    const c = weather.current;
    const wmoCode = c.weather_code;
    const descriptions: Record<number, string> = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
      55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Slight rain showers",
      81: "Moderate rain showers", 82: "Violent rain showers", 85: "Slight snow showers",
      86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail",
    };

    return {
      city: loc.name,
      country: loc.country,
      coordinates: { lat: loc.latitude, lon: loc.longitude },
      temperature: `${c.temperature_2m}°${units === "fahrenheit" ? "F" : "C"}`,
      feelsLike: `${c.apparent_temperature}°${units === "fahrenheit" ? "F" : "C"}`,
      condition: descriptions[wmoCode] || `Code ${wmoCode}`,
      humidity: `${c.relative_humidity_2m}%`,
      wind: `${c.wind_speed_10m} km/h`,
      precipitation: `${c.precipitation} mm`,
      source: "open-meteo.com",
    };
  },
};
