import type { Track } from '../core/library';
import { saveAudio } from '../storage';
export async function importAudio(file: File): Promise<Track> {
  if (!file.name.toLowerCase().endsWith('.mp3')) throw new Error('Choose an MP3 audio file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose an MP3 smaller than 50 MB.');
  const header = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (
    !(header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) &&
    !(header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  )
    throw new Error('This file does not contain a recognizable MP3 header.');
  let title = file.name.replace(/\.mp3$/i, '');
  let artist = 'Local audio';
  let album = 'Imported MP3';
  // Read ID3v1 metadata with our own parser. Modern-only tags use the filename.
  if (file.size >= 128) {
    const tags = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
    const decoder = new TextDecoder('windows-1252');
    if (decoder.decode(tags.subarray(0, 3)) === 'TAG') {
      title = decoder.decode(tags.subarray(3, 33)).replace(/\0/g, '').trim() || title;
      artist = decoder.decode(tags.subarray(33, 63)).replace(/\0/g, '').trim() || artist;
      album = decoder.decode(tags.subarray(63, 93)).replace(/\0/g, '').trim() || album;
    }
  }
  const url = URL.createObjectURL(file);
  let durationMs: number;
  try {
    durationMs = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const timer = setTimeout(() => {
        audio.removeAttribute('src');
        audio.load();
        reject(new Error('Could not read this MP3. Try another file.'));
      }, 10000);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
        audio.removeAttribute('src');
        audio.load();
      };
      audio.onerror = () => {
        clearTimeout(timer);
        reject(new Error('This MP3 is not supported by your browser.'));
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const blobId = crypto.randomUUID();
  await saveAudio(blobId, file);
  return { source: 'local', title, artist, album, durationMs, cover: '', blobId };
}
