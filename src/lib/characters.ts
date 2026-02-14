import { Character } from "./types";

export const characters: Character[] = [
  {
    id: "sobacchi",
    name: "そばっち",
    region: "盛岡",
    description:
      "岩手名物・わんこそばをモチーフにした「わんこ兄弟」の一人。おそばのように気長なのんびり屋で、岩手の魅力を広めるために旅をする元気なキャラクター。",
    model_path: "models/wanko1.obj",
    mtl_path: "models/wanko1.mtl",
    thumbnail: "images/other/wanko.png",
    tags: ["わんこそば", "公式キャラ"],
    renderProfile: {
      scaleMultiplier: 1.08,
      positionOffset: { y: -0.06 },
      forceDoubleSide: true,
      disableFrustumCulling: true,
      materialAlphaTest: 0.1,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      computeVertexNormals: true,
    },
  },
  {
    id: "karin",
    name: "カリンちゃん",
    region: "遠野",
    description:
      "遠野物語のカッパをモチーフにした遠野市公式キャラクター。観光イベントや特産品PRにも参加し、カッパらしくきゅうり好き。",
    model_path: "models/kappa.obj",
    thumbnail: "images/cities/Tono_icon.jpg",
    tags: ["カッパ", "伝承"],
    renderProfile: {
      scaleMultiplier: 1.05,
      forceDoubleSide: true,
      disableFrustumCulling: true,
      materialAlphaTest: 0.08,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      computeVertexNormals: true,
    },
  },
  {
    id: "kerohira",
    name: "ケロ平",
    region: "平泉",
    description:
      "平泉のカエル戯画をモチーフにした世界遺産平泉PRキャラクター。平和と共生の理念を伝えるためSNSやイベントで活動中。",
    model_path: "models/kerohira1.obj",
    mtl_path: "models/kerohira1.mtl",
    thumbnail: "images/cities/Hiraizumi_icon.jpg",
    tags: ["世界遺産", "PR"],
    renderProfile: {
      scaleMultiplier: 0.9,
      forceDoubleSide: true,
      disableFrustumCulling: true,
      materialAlphaTest: 0.1,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      computeVertexNormals: true,
    },
  },
  {
    id: "enzo",
    name: "えんぞー",
    region: "普代",
    description:
      "普代村の特産品「塩蔵昆布」をモチーフにしたキャラクター。海の恵みをPRするためイベントやSNSで活躍。",
    model_path: "models/enzo.obj",
    mtl_path: "models/enzo.mtl",
    thumbnail: "images/cities/Hudai_icon.jpg",
    tags: ["三陸", "昆布"],
    renderProfile: {
      scaleMultiplier: 1.15,
      forceDoubleSide: true,
      disableFrustumCulling: true,
      materialAlphaTest: 0.1,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      computeVertexNormals: true,
    },
  },
  {
    id: "goshodon",
    name: "ごしょどん",
    region: "一戸",
    description:
      "世界遺産「御所野遺跡」のPRキャラクター。5000年前の森の妖精として町内外のイベントに参加し情報を発信している。",
    model_path: "models/goshodon.obj",
    thumbnail: "images/cities/Ichinohe_icon.jpg",
    tags: ["縄文", "遺跡"],
    renderProfile: {
      scaleMultiplier: 0.88,
      forceDoubleSide: true,
      disableFrustumCulling: true,
      materialAlphaTest: 0.1,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      computeVertexNormals: true,
    },
  },
];

// Camera / Character で共通利用するモデル参照元
export const characterModelCatalog = characters
  .filter((ch) => Boolean(ch.model_path))
  .map((ch) => ({
    id: ch.id,
    model_path: ch.model_path as string,
    mtl_path: ch.mtl_path ?? null,
    renderProfile: ch.renderProfile,
  }));
