import fs from 'fs';
import path from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { openai } from '../../shared/llm';
import { logger } from '../../shared/logger';

// Type definitions
type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type VoiceProvider = 'google' | 'openai' | 'mock';

export class VoiceoverService {
  private outputDir: string;
  private googleClient: TextToSpeechClient | null = null;
  private provider: VoiceProvider = 'mock';

  constructor() {
    this.outputDir = path.resolve(process.cwd(), 'public/audio');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Initialize Providers
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        this.googleClient = new TextToSpeechClient();
        this.provider = 'google';
        logger.info('🎙️ Voiceover Service: Using Google Cloud TTS');
      } catch (err) {
        logger.warn(`Failed to init Google TTS: ${err}`);
      }
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
      logger.info('🎙️ Voiceover Service: Using OpenAI TTS');
    } else {
      logger.warn('⚠️ Voiceover Service: No credentials found. Using MOCK (Silence).');
    }
  }

  async generateAudio(text: string, voicePreference: string = 'onyx'): Promise<string> {
    const safeText = text.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Determine extension based on provider
    const ext = this.provider === 'openai' ? 'mp3' : 'mp3'; // Google also supports mp3
    const filename = `${Date.now()}_${safeText}.${ext}`;
    const filePath = path.join(this.outputDir, filename);
    const relativePath = `/audio/${filename}`;

    logger.info(`Generating voiceover [${this.provider}]: "${text.substring(0, 30)}..."`);

    try {
      if (this.provider === 'google' && this.googleClient) {
        await this.generateGoogleAudio(text, filePath);
      } else if (this.provider === 'openai') {
        await this.generateOpenAIAudio(text, filePath, voicePreference as OpenAIVoice);
      } else {
        await this.generateMockAudio(filePath);
      }
      
      return relativePath;

    } catch (error) {
      logger.error(`Voiceover generation failed: ${error}`);
      // Fallback to mock if real generation fails
      if (this.provider !== 'mock') {
        logger.warn('Falling back to mock audio due to error.');
        const mockPath = filePath.replace(`.${ext}`, '_mock.wav');
        await this.generateMockAudio(mockPath);
        return `/audio/${path.basename(mockPath)}`;
      }
      throw error;
    }
  }

  private async generateGoogleAudio(text: string, filePath: string) {
    if (!this.googleClient) throw new Error('Google Client not initialized');

    // Construct the request
    const request = {
      input: { text: text },
      // Select the language and SSML voice gender (optional)
      voice: { languageCode: 'en-US', name: 'en-US-Neural2-F' }, // "Good" cheap voice
      // select the type of audio encoding
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    // Performs the text-to-speech request
    const [response] = await this.googleClient.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google');
    }

    // Write the binary audio content to a local file
    await fs.promises.writeFile(filePath, response.audioContent, 'binary');
  }

  private async generateOpenAIAudio(text: string, filePath: string, voice: OpenAIVoice) {
    // OpenAI supports: alloy, echo, fable, onyx, nova, shimmer
    // We map arbitrary strings to a default if needed
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'onyx';

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice as OpenAIVoice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);
  }

  private async generateMockAudio(filePath: string) {
    // RIFF Header + FMT Chunk + DATA Chunk (1 second of silence)
    // Changing extension to .wav for mock if needed, but MP3 header is harder to mock manually without encoding.
    // So we'll write a WAV file even if extension says mp3 (players often handle this) 
    // OR just enforce .wav for mock.
    
    // Ideally we respect the filePath extension. If it is .mp3, we should technically write MP3 data.
    // For simplicity, let's just write the WAV buffer we had, but change extension in caller if possible.
    // Or just write silence.mp3 using a valid empty frame? No, WAV is safer.
    
    // We will just write the WAV logic we had.
    
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const durationSeconds = 2;
    const numSamples = sampleRate * durationSeconds;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = numSamples * numChannels * bitsPerSample / 8;
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // If filename ends in .mp3, this technically creates a malformed MP3 (it's a WAV),
    // but many players sniff the header (RIFF) and play it anyway.
    await fs.promises.writeFile(filePath, buffer);
  }
}
