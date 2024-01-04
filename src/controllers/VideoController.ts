import { NextFunction, Request, Response } from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffProbeInstaller from "@ffprobe-installer/ffprobe";
import { resolve, extname, join } from "path";
import { existsSync, mkdirSync, unlink } from "fs";
import HttpError from "../utils/HttpError";

export default async function transcodeVideo(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file)
      return next(new HttpError("Upload a file to begin transcoding", 400));
    // const inputFileName = req.params.name;

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
    const manifestPath = `${outputDir}/${outputDirName}.m3u8`;

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    ["720p", "480p"].forEach((resolution) => {
      const resolutionDir = join(outputDir, resolution);
      if (!existsSync(resolutionDir)) {
        mkdirSync(resolutionDir, { recursive: true });
      }
    });

    const command = ffmpeg(inputFilePath)
      .setFfmpegPath(ffmpegInstaller.path)
      .setFfprobePath(ffProbeInstaller.path)
      .outputOptions([
        "-hls_time 10", // Set segment duration (in seconds)
        "-hls_list_size 0", // Allow an unlimited number of segments in the playlist
      ])
      .output(join(outputDir, "720p", `${filename}_720p.m3u8`))
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf scale=1280:720", // Set resolution to 720p
        "-b:v 2M", // Set video bitrate for 720p
        //   "-hls_segment_filename", join(outputDir, `${filename}_720p_%d.ts`),
        //   "-hls_segment_filename", `${outputDir}/720p/${filename}_%d.ts`,
        // "-hls_segment_filename", `${outputDir}\\720p\\${filename}_%d.ts`,
        //   "-hls_segment_filename", `${outputDir}\\${filename}_720_%d.ts`
        //   "-hls_segment_filename", `${filename}_720_%d.ts`
          "-hls_segment_filename", `src/videos/transcoded/${filename}/720p/${filename}_720_%d.ts`
      ])
      .output(join(outputDir, "480p", `${filename}_480p.m3u8`))
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf scale=854:480", // Set resolution to 480p
        "-b:v 1M", // Set video bitrate for 480p
        //   "-hls_segment_filename", join(outputDir, `${filename}_480p_%d.ts`),
        //   "-hls_segment_filename", `${outputDir}/480p/${filename}_%d.ts`,
        "-hls_segment_filename", `src/videos/transcoded/${filename}/480p/${filename}_480_%d.ts`
        // "-hls_segment_filename", `${outputDir}\\480p\\${filename}_%d.ts`,
        //   "-hls_segment_filename", `${outputDir}\\${filename}_480_%d.ts`
        //   "-hls_segment_filename", `${filename}_480_%d.ts`
      ]);

    command.on("end", () => {
      unlink(inputFilePath, (err) => {
        if (err) throw new HttpError((err as Error).message, 500);
        console.info(
          `Transcoding completed. Raw file removed from ${inputFilePath}`
        );
      });
      res
        .status(200)
        .json({ message: "Transcoding completed", manifest: manifestPath });
    });

    command.output(manifestPath).run();
  } catch (error) {
    console.error(`Transcoding failed: `, error);
    return res.status(500).json(error);
  }
}
