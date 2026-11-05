import officialSpots from "@/data/official-spots.json";
import { City, Event, Favorite, Genre, Spot, StampCatalog } from "./types";

/**
 * 今日からの相対日付を `YYYY-MM-DD` で返す。
 *
 * @param offsetDays - 今日からの日数差
 * @returns 日付文字列
 * @example
 * buildRelativeDate(3);
 */
function buildRelativeDate(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Mock fallback data used when Supabase environment variables are missing.
const baseMockCities: City[] = [
  {
    id: 1,
    name: "盛岡市",
    name_kana: "もりおかし",
    region: "内陸",
    image_path: "images/cities/Morioka_icon.jpg",
  },
  {
    id: 2,
    name: "平泉町",
    name_kana: "ひらいずみちょう",
    region: "内陸",
    image_path: "images/cities/Hiraizumi_icon.jpg",
  },
  {
    id: 3,
    name: "岩泉町",
    name_kana: "いわいずみちょう",
    region: "沿岸",
    image_path: "images/cities/Iwaizumi_icon.jpg",
  },
];

export const mockCities: City[] = [
  ...baseMockCities,
  ...officialSpots.filter((spot, index, all) => !baseMockCities.some(city => city.id === spot.mockCityId) && all.findIndex(other => other.mockCityId === spot.mockCityId) === index)
    .map(spot => ({ id: spot.mockCityId, name: spot.city, name_kana: spot.cityKana, region: spot.region, image_path: null })),
];

export const mockGenres: Genre[] = [
  { id: 1, name: "歴史", image_path: "images/genres/History.jpg" },
  { id: 2, name: "自然", image_path: "images/genres/KitakamiRiver.jpg" },
  { id: 3, name: "グルメ", image_path: "images/genres/Food.jpg" },
  { id: 4, name: "体験", image_path: "images/genres/Activity.jpg" },
];

export const mockSpots: Spot[] = [
  {
    id: 1,
    name: "盛岡城跡公園",
    description: "南部氏の居城跡。石垣と公園の緑が調和し、桜の名所。",
    city_id: 1,
    genre_id: 1,
    lat: 39.7021,
    lng: 141.1527,
    image_path: "images/spots/Morioka_Nature_MoriokajousiKouen.jpg",
    model_path: null,
    reference_url: "http://www.moriokashiroato.jp/",
  },
  {
    id: 2,
    name: "中尊寺 金色堂",
    description: "奥州藤原氏が築いた黄金の阿弥陀堂。世界遺産。",
    city_id: 2,
    genre_id: 1,
    lat: 38.9865,
    lng: 141.1176,
    // 対象の写真がないため、別寺院の写真で代替しない。
    image_path: null,
    model_path: "models/goshodon.obj",
    reference_url: null,
  },
  {
    id: 3,
    name: "龍泉洞",
    description: "日本三大鍾乳洞の一つ。透明度の高い地底湖が魅力。",
    city_id: 3,
    genre_id: 2,
    lat: 39.8383,
    lng: 141.7989,
    image_path: "images/spots/Iwaizumi_Nature_Ryusendo.jpg",
    model_path: null,
    reference_url: "https://iwatetabi.jp/spots/5681/",
  },
  {
    id: 4,
    name: "わんこそば体験",
    description: "岩手名物を体験できる定番アクティビティ。",
    city_id: 1,
    genre_id: 3,
    lat: 39.7036,
    lng: 141.1527,
    image_path: "images/other/wanko.png",
    model_path: "models/wanko1.obj",
    reference_url: null,
  },
  ...officialSpots.map(spot => ({
    id: spot.mockId, name: spot.name, description: spot.description,
    city_id: spot.mockCityId, genre_id: spot.mockGenreId, lat: spot.lat, lng: spot.lng,
    image_path: null, image_thumb_path: null, model_path: null, reference_url: spot.referenceUrl,
  })),
].map(spot => ({ ...spot, isSample: true }));

export const mockEvents: Event[] = [
  {
    id: 1,
    title: "盛岡週末ナイトマーケット",
    location: "盛岡市",
    start_date: buildRelativeDate(2),
    end_date: buildRelativeDate(4),
    city_id: 1,
  },
  {
    id: 2,
    title: "平泉ライトアップ散策",
    location: "平泉町",
    start_date: buildRelativeDate(6),
    end_date: buildRelativeDate(6),
    city_id: 2,
  },
  {
    id: 3,
    title: "龍泉洞ブルー体験デー",
    location: "岩泉町",
    start_date: buildRelativeDate(12),
    end_date: buildRelativeDate(13),
    city_id: 3,
  },
];

export const mockFavorites: Favorite[] = [];

/** 接続障害時の閲覧専用スタンプ対象。実データのIDと一致しても保存しない。 */
export const mockStampCatalog: StampCatalog = { spots: mockSpots, cities: mockCities, isSample: true };
