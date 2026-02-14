export type City = {
  id: number;
  name: string;
  name_kana?: string | null;
  region?: string | null;
  image_thumb_path?: string | null;
  image_path?: string | null;
};

export type Genre = {
  id: number;
  name: string;
  image_thumb_path?: string | null;
  image_path?: string | null;
};

export type Spot = {
  id: number;
  name: string;
  description: string;
  city_id: number;
  genre_id: number;
  lat: number;
  lng: number;
  image_thumb_path?: string | null;
  image_path?: string | null;
  model_path?: string | null;
  reference_url?: string | null;
};

export type Stamp = {
  id: number;
  user_id: number;
  spot_id: number;
  created_at: string;
};

export type User = {
  id: number;
  auth_id: string | null;
  display_name: string;
};

export type Event = {
  id: number;
  title: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city_id?: number | null;
};

export type CharacterRenderProfile = {
  scaleMultiplier?: number;
  rotation?: {
    x?: number;
    y?: number;
    z?: number;
  };
  positionOffset?: {
    x?: number;
    y?: number;
    z?: number;
  };
  forceDoubleSide?: boolean;
  disableFrustumCulling?: boolean;
  materialAlphaTest?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  computeVertexNormals?: boolean;
};

export type Character = {
  id: string;
  name: string;
  region: string;
  description: string;
  model_path?: string | null;
  mtl_path?: string | null;
  thumbnail?: string | null;
  tags?: string[];
  renderProfile?: CharacterRenderProfile;
};
