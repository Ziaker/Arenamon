import type {AuthoringFps, TextureDocument} from '../core/types';

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};
const base64ToBytes = (value: string): Uint8Array => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const validId = (value: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);

export function createTextureDocument(options: {id: string; name: string; width?: number; height?: number; spriteSheet?: {columns: number; rows: number; fps: AuthoringFps}}): TextureDocument {
  const width = options.width ?? 256, height = options.height ?? 256;
  const texture: TextureDocument = {id: options.id, name: options.name, width, height, rgbaBase64: bytesToBase64(new Uint8Array(width * height * 4)), ...(options.spriteSheet ? {spriteSheet: options.spriteSheet} : {})};
  const checked = validateTextureDocument(texture);
  if (!checked.ok) throw new Error(checked.message);
  return texture;
}

export function decodeTexturePixels(texture: TextureDocument): Uint8Array { return base64ToBytes(texture.rgbaBase64); }

export function validateTextureDocument(value: unknown): {ok: true} | {ok: false; message: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok: false, message: 'Documento de textura inválido'};
  const texture = value as TextureDocument;
  if (!validId(texture.id) || !texture.name?.trim()) return {ok: false, message: 'ID e nome de textura obrigatórios'};
  if (!Number.isSafeInteger(texture.width) || !Number.isSafeInteger(texture.height) || texture.width < 1 || texture.height < 1 || texture.width > 1024 || texture.height > 1024) return {ok: false, message: 'Dimensões de textura inválidas'};
  let pixels: Uint8Array;
  try { pixels = base64ToBytes(texture.rgbaBase64); } catch { return {ok: false, message: 'RGBA base64 inválido'}; }
  if (pixels.length !== texture.width * texture.height * 4) return {ok: false, message: 'RGBA não corresponde às dimensões'};
  const sheet = texture.spriteSheet;
  if (sheet && (!Number.isSafeInteger(sheet.columns) || !Number.isSafeInteger(sheet.rows) || sheet.columns < 1 || sheet.rows < 1 || sheet.columns > 64 || sheet.rows > 64 || ![24, 30, 60].includes(sheet.fps))) return {ok: false, message: 'Spritesheet inválida'};
  return {ok: true};
}

export function paintTextureStroke(texture: TextureDocument, brush: {x: number; y: number; radius: number; color: string; opacity: number}): TextureDocument {
  if (![brush.x, brush.y, brush.radius, brush.opacity].every(Number.isFinite) || brush.radius <= 0 || brush.opacity < 0 || brush.opacity > 1 || !/^#[0-9a-f]{6}$/i.test(brush.color)) throw new Error('Pincel inválido');
  const pixels = decodeTexturePixels(texture), color = [1, 3, 5].map(index => parseInt(brush.color.slice(index, index + 2), 16));
  for (let y = 0; y < texture.height; y++) for (let x = 0; x < texture.width; x++) if (Math.hypot(x - brush.x, y - brush.y) <= brush.radius) {
    const i = (y * texture.width + x) * 4, alpha = brush.opacity;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c] * (1 - alpha) + color[c] * alpha);
    pixels[i + 3] = Math.round(255 * (alpha + (pixels[i + 3] / 255) * (1 - alpha)));
  }
  return {...texture, rgbaBase64: bytesToBase64(pixels)};
}
