import { expect, it } from "vitest";
import * as THREE from "three";
import { applyLegacyMeshFixes } from "./characterMaterials";

it.each([0xffffff, 0x000000])("画像の到着前後で材質色を変えない (%s)", color => {
  const pending = new THREE.Texture();
  const image = document.createElement("canvas");
  image.width = image.height = 1;
  const loaded = new THREE.Texture(image);
  const materials = [pending, loaded].map(map => new THREE.MeshLambertMaterial({ color, map }));
  const group = new THREE.Group();
  materials.forEach(material => group.add(new THREE.Mesh(new THREE.BoxGeometry(), material)));
  applyLegacyMeshFixes(group);
  pending.image = image;
  expect(materials.map(material => material.color.getHex())).toEqual([color, color]);
  group.children.forEach(child => (child as THREE.Mesh).geometry.dispose());
  materials.forEach(material => material.dispose());
  pending.dispose();
  loaded.dispose();
});

it.each([[0xffffff, 0x888888], [0x000000, 0x555555]])("画像のない材質は従来の補正を維持する (%s)", (color, expected) => {
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  applyLegacyMeshFixes(mesh);
  expect(material.color.getHex()).toBe(expected);
  mesh.geometry.dispose();
  material.dispose();
});
