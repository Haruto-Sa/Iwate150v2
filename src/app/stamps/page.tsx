import StampPage from "@/app/stamp/page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Stamps",
  description: "旅先でスタンプを集めながら、岩手のスポット巡りを楽しめます。",
  path: "/stamps",
});

export default StampPage;
