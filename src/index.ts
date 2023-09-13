import express, {Application, Request, Response} from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

const app: Application = express();
const PORT: number = 3000;
const outputDirectory: string = 'output-chunks';

const chunkDuration: number = 10;
const videoPath: string = "path-to-video.mp4"


ffmpeg.setFfmpegPath("C:\\Users\\Intern\\Documents\\ffmpeg-6.0-essentials_build\\bin\\ffmpeg.exe");

function splitVideo(inputPath: string, outputPath: string, startTime: number, duration: number) {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(inputPath)
            .inputOptions([`-ss ${startTime}`, `-t ${duration}`])
            .output(outputPath)
            .on('end', () => {
                console.log(`Video chunk saved to: ${outputPath}`);
                resolve();
            })
            .on('error', (err) => {
                console.error('Error splitting video:', err);
                reject(err);
            })
            .run();
    });
}


app.get('/stream-video', async (req: Request, res: Response) => {
    const batch: number = parseInt(req.query.batch as string, 10) || 1;

    if (batch < 1) {
        return res.status(400).json({error: 'Invalid batch number'});
    }
    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory);
    }

    const startTimestamp: number = (batch - 1) * chunkDuration;
    const endTimestamp: number = startTimestamp + chunkDuration;

    const outputFileName: string = `${outputDirectory}/chunk_${startTimestamp}_${endTimestamp}.mp4`;

    if (!fs.existsSync(outputFileName)) {
        try {
            await splitVideo(videoPath, outputFileName, startTimestamp, chunkDuration);
        } catch (error) {
            console.error('Error splitting video on-demand:', error);
            return res.status(500).json({error: 'Internal server error'});
        }
    }

    // if (!fs.existsSync(outputFileName)) {
    //     return res.status(404).json({ error: 'Batch not found' });
    // }

    try {
        const absolutePath: string = path.resolve(outputFileName);
        res.sendFile(absolutePath);
    } catch (error) {
        console.error('Error serving video batch:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
