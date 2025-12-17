import fs from 'fs';
import path from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { openai } from '../../shared/llm';
import { logger } from '../../shared/logger';

// ============================================================================
// Type Definitions
// ============================================================================

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type VoiceProvider = 'google' | 'openai' | 'mock';

const VALID_OPENAI_VOICES: readonly OpenAIVoice[] = [
  'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
] as const;

// ============================================================================
// WAV Constants for Mock Audio
// ============================================================================

const WAV_CONFIG = {
  sampleRate: 44100,
  numChannels: 1,
  bitsPerSample: 16,
  durationSeconds: 2
} as const;

// ============================================================================
// Implementation
// ============================================================================

export class VoiceoverService {
  private readonly outputDir: string;
  private googleClient: TextToSpeechClient | null = null;
  private provider: VoiceProvider = 'mock';

  constructor() {
    this.outputDir = path.resolve(process.cwd(), 'public/audio');
    this.ensureOutputDir();
    this.initializeProvider();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private initializeProvider(): void {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const resolvedCredsPath = path.isAbsolute(creds)
          ? creds
          : path.resolve(process.cwd(), creds);

        // IMPORTANT:
        // In Docker, it's common for GOOGLE_APPLICATION_CREDENTIALS to be set
        // but the file not to be mounted. In that case, Google TTS will throw
        // and can destabilize the worker. We verify the file exists before
        // selecting Google as the provider.
        if (fs.existsSync(resolvedCredsPath)) {
          this.googleClient = new TextToSpeechClient();
          this.provider = 'google';
          logger.info('🎙️ Voiceover Service: Using Google Cloud TTS');
          return;
        }

        logger.warn(
          `GOOGLE_APPLICATION_CREDENTIALS is set but file is missing at: ${resolvedCredsPath}. Falling back to OpenAI or MOCK.`
        );
      } catch (err) {
        logger.warn(`Failed to init Google TTS: ${err}`);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
      logger.info('🎙️ Voiceover Service: Using OpenAI TTS');
      return;
    }

    logger.warn('⚠️ Voiceover Service: No credentials found. Using MOCK (Silence).');
  }

  async generateAudio(text: string, voicePreference: string = 'onyx'): Promise<string> {
    const safeText = this.sanitizeFilename(text);
    // IMPORTANT:
    // - Google/OpenAI produce MP3.
    // - Our mock fallback generates a *WAV* buffer (silence), so we must use
    //   `.wav` when provider === 'mock' to avoid writing WAV bytes into an `.mp3`.
    const ext = this.provider === 'mock' ? 'wav' : 'mp3';
    const filename = `${Date.now()}_${safeText}.${ext}`;
    const filePath = path.join(this.outputDir, filename);
    const relativePath = `/audio/${filename}`;

    logger.info(`Generating voiceover [${this.provider}]: "${text.substring(0, 30)}..."`);

    try {
      await this.generateWithProvider(text, filePath, voicePreference);
      return relativePath;
    } catch (error) {
      logger.error(`Voiceover generation failed: ${error}`);
      return this.handleFallback(filePath, ext);
    }
  }

  private sanitizeFilename(text: string): string {
    return text.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  private async generateWithProvider(
    text: string,
    filePath: string,
    voicePreference: string
  ): Promise<void> {
    switch (this.provider) {
      case 'google':
        if (!this.googleClient) {
          throw new Error('Google client not initialized');
        }
        await this.generateGoogleAudio(text, filePath);
        break;
      case 'openai':
        await this.generateOpenAIAudio(text, filePath, voicePreference as OpenAIVoice);
        break;
      default:
        await this.generateMockAudio(filePath);
    }
  }

  private async handleFallback(filePath: string, ext: string): Promise<string> {
    if (this.provider === 'mock') {
      throw new Error('Mock audio generation failed');
    }

    logger.warn('Falling back to mock audio due to error.');
    const mockPath = filePath.replace(`.${ext}`, '_mock.wav');
    await this.generateMockAudio(mockPath);
    return `/audio/${path.basename(mockPath)}`;
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

  private async generateOpenAIAudio(
    text: string,
    filePath: string,
    voice: OpenAIVoice
  ): Promise<void> {
    const selectedVoice = this.validateOpenAIVoice(voice);

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);
  }

  private validateOpenAIVoice(voice: string): OpenAIVoice {
    return VALID_OPENAI_VOICES.includes(voice as OpenAIVoice)
      ? (voice as OpenAIVoice)
      : 'onyx';
  }

  private async generateMockAudio(filePath: string): Promise<void> {
    const buffer = this.createSilentWavBuffer();
    await fs.promises.writeFile(filePath, buffer);
  }

  private createSilentWavBuffer(): Buffer {
    const { sampleRate, numChannels, bitsPerSample, durationSeconds } = WAV_CONFIG;
    
    const numSamples = sampleRate * durationSeconds;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = (numSamples * numChannels * bitsPerSample) / 8;
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write('WAVE', 8);

    // Format Chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);           // Chunk size
    buffer.writeUInt16LE(1, 20);            // Audio format (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // Data Chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    // Silence (zeros) already filled by Buffer.alloc

    return buffer;
  }
}
