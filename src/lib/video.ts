/**
 * ffmpeg.wasm 封装：字幕帧 + 多段 mp3 → MP4
 * 使用单线程 @ffmpeg/core@0.12.6（core 文件部署在 /ffmpeg/ 下）
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

export interface AssembleInput {
  /** 每个字幕帧的 PNG 数据与时长（秒），顺序即播放顺序 */
  frames: { data: Blob; duration: number }[];
  /** 依次拼接的 mp3 音频段 */
  audios: Blob[];
  /** 0-1 进度回调（仅合成阶段） */
  onProgress?: (ratio: number) => void;
}

export interface AssembleOutput {
  blobUrl: string;
  blob: Blob;
}

/**
 * 用 ffmpeg.wasm 合成 MP4。
 * 每次调用创建全新实例，结束后 terminate 释放资源。
 */
export async function assembleVideo(input: AssembleInput): Promise<AssembleOutput> {
  const { frames, audios, onProgress } = input;
  if (frames.length === 0) throw new Error("没有可用的视频帧");
  if (audios.length === 0) throw new Error("没有可用的配音音频");

  const ffmpeg = new FFmpeg();
  try {
    // 单线程 core，从本站 /ffmpeg/ 加载（dev 与生产路径一致）
    const coreURL = await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript");
    const wasmURL = await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm");
    await ffmpeg.load({ coreURL, wasmURL });

    if (onProgress) {
      ffmpeg.on("progress", ({ progress }) => {
        const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
        onProgress(ratio);
      });
    }

    // 写入字幕帧
    for (let i = 0; i < frames.length; i++) {
      const name = `frame_${String(i).padStart(3, "0")}.png`;
      const buf = new Uint8Array(await frames[i].data.arrayBuffer());
      await ffmpeg.writeFile(name, buf);
    }

    // 写入音频段
    for (let i = 0; i < audios.length; i++) {
      const buf = new Uint8Array(await audios[i].arrayBuffer());
      await ffmpeg.writeFile(`audio_${i}.mp3`, buf);
    }

    // 拼接音频（先尝试流复制，失败则重编码）
    const audioList = audios.map((_, i) => `file 'audio_${i}.mp3'`).join("\n");
    await ffmpeg.writeFile("audios.txt", new TextEncoder().encode(audioList));
    let concatOk = false;
    try {
      const code = await ffmpeg.exec([
        "-f", "concat", "-safe", "0",
        "-i", "audios.txt",
        "-c", "copy",
        "all.mp3",
      ]);
      concatOk = code === 0;
    } catch {
      concatOk = false;
    }
    if (!concatOk) {
      const code = await ffmpeg.exec([
        "-f", "concat", "-safe", "0",
        "-i", "audios.txt",
        "-c:a", "libmp3lame",
        "all.mp3",
      ]);
      if (code !== 0) throw new Error("音频拼接失败");
    }

    // 帧列表：file + duration，最后重复最后一帧（concat demuxer 要求）
    const frameLines: string[] = [];
    frames.forEach((f, i) => {
      frameLines.push(`file 'frame_${String(i).padStart(3, "0")}.png'`);
      frameLines.push(`duration ${Math.max(0.1, f.duration).toFixed(3)}`);
    });
    frameLines.push(`file 'frame_${String(frames.length - 1).padStart(3, "0")}.png'`);
    await ffmpeg.writeFile("frames.txt", new TextEncoder().encode(frameLines.join("\n")));

    // 合成 MP4
    const code = await ffmpeg.exec([
      "-f", "concat", "-safe", "0",
      "-i", "frames.txt",
      "-i", "all.mp3",
      "-vf", "fps=24,format=yuv420p",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "24",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      "out.mp4",
    ]);
    if (code !== 0) throw new Error("视频合成失败（ffmpeg 退出码非 0）");

    const data = await ffmpeg.readFile("out.mp4");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
    const blobUrl = URL.createObjectURL(blob);
    return { blobUrl, blob };
  } finally {
    try {
      ffmpeg.terminate();
    } catch {
      // 实例可能已释放
    }
  }
}
