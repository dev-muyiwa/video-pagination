import { NextFunction, Request, Response } from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffProbeInstaller from "@ffprobe-installer/ffprobe";
import path, { resolve, extname, join } from "path";
import fs, { existsSync, mkdirSync, unlink } from "fs";
import HttpError from "../utils/HttpError";

export default async function transcodeVideo(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file)
      return next(new HttpError("Upload a file to begin transcoding", 400));

    const outputDirName = req.file.originalname.split(
      extname(req.file.originalname)
    )[0];

    const inputFileName = req.file.originalname;
    const inputFilePath = resolve(__dirname, `../videos/raw/${inputFileName}`); // change this to use the file from the request.
    const filename = inputFileName.split(".")[0];
    const outputDir = resolve(
      __dirname,
      `../videos/transcoded/${outputDirName}`
    );

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputOptions = [
      "-f hls",
      "-hls_time 10",
      "-hls_flags independent_segments",
      "-hls_list_size 0",
      "-hls_playlist_type vod",
    ];

    const variantStreams = [
      {
        resolution: "360p",
        videoBitrate: "600",
        audioBitrate: "96",
        scale: "480:360",
      },
      {
        resolution: "480p",
        videoBitrate: "1000",
        audioBitrate: "128",
        scale: "640:480",
      },
      {
        resolution: "720p",
        videoBitrate: "2000",
        audioBitrate: "192",
        scale: "1280:720",
      },
      {
        resolution: "1080p",
        videoBitrate: "5500",
        audioBitrate: "192",
        scale: "1920:1080",
      },
    ];

    const variantPlaylistPaths: string[] = [];

    variantStreams.forEach((variant) => {
      const resolutionDir = join(outputDir, variant.resolution);
      if (!existsSync(resolutionDir)) {
        mkdirSync(resolutionDir, { recursive: true });
      }

      // const variantPlaylistPath = join(
      //   variant.resolution,
      //   `${filename}.m3u8`
      // );
      const variantPlaylistPath = variant.resolution + "/" + `${filename}.m3u8`;

      ffmpeg(inputFilePath)
        .setFfmpegPath(ffmpegInstaller.path)
        .setFfprobePath(ffProbeInstaller.path)
        .format("hls")
        // .hls_time("10")
        .outputOptions(outputOptions)
        .output(join(outputDir, variant.resolution, `${filename}.m3u8`))
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-vf",
          `scale=${variant.scale}`, // Set resolution to 720p
          "-b:v",
          `${variant.videoBitrate}k`, // Set video bitrate for 720p
          "-b:a",
          `${variant.audioBitrate}k`, // Set audio bitrate for 720p
          "-hls_segment_filename",
          `src/videos/transcoded/${filename}/${variant.resolution}/${filename}_%03d.ts`,
        ])
        .on("progress", (progress) => {
          console.log(
            `Processing: ${variant.resolution} is ${progress.percent.toFixed(
              1
            )}% done`
          );
        })
        .on("end", () => {
          console.log(`Transcoding for ${variant.resolution} completed`);
          variantPlaylistPaths.push(variantPlaylistPath);

          if (variantPlaylistPaths.length === variantStreams.length) {
            const masterPlaylistPath = generateMasterPlaylist(
              variantPlaylistPaths,
              variantStreams,
              outputDir
            );
            unlink(inputFilePath, (err) => {
              if (err) throw new HttpError((err as Error).message, 500);
              console.log("Original file removed from server.");
            });
            res.status(200).json({
              message: "Transcoding completed",
              manifest: masterPlaylistPath,
            });
          }
        })
        .run();
    });
  } catch (error) {
    console.error(`Transcoding failed: `, error);
    return res.status(500).json(error);
  }
}

function generateMasterPlaylist(
  variantPlaylistPaths: string[],
  variantStreams: any[],
  outputDir: string
) {
  let masterPlaylistContent = `#EXTM3U\n#EXT-X-VERSION:3\n`;

  variantStreams.forEach((variant, index) => {
    masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${
      parseFloat(variant.videoBitrate) * 1000
    },RESOLUTION=${variant.scale}\n${variantPlaylistPaths[index]}\n`;
  });

  const masterPlaylistPath = join(outputDir, "master.m3u8");
  // Write master playlist content to file
  const directory = path.dirname(masterPlaylistPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  require("fs").writeFileSync(masterPlaylistPath, masterPlaylistContent);

  console.log("Master playlist generated");

  return masterPlaylistPath;
}
