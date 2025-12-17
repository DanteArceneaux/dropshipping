import dotenv from 'dotenv';
import path from 'path';

// Load secrets.env explicitly
dotenv.config({ path: path.resolve(process.cwd(), 'secrets.env') });

import { VideoRenderer } from '../services/media/renderer';
import { logger } from '../shared/logger';

// Mock script data
const mockScript = {
  scenes: [
    {
      timestamp: '0:00-0:03',
      visual: 'Stop scrolling! You need to see this.',
      audio: 'Stop scrolling right now! You seriously need to see this gadget.'
    },
    {
      timestamp: '0:03-0:06',
      visual: 'It cleans everything instantly.',
      audio: 'It literally cleans everything in your house instantly.'
    },
    {
      timestamp: '0:06-0:10',
      visual: 'Link in bio to get yours.',
      audio: 'Check the link in bio to get yours today before it sells out.'
    }
  ]
};

// Mock images (using placeholder images)
// Use a more reliable static image source or base64 to avoid DNS issues in headless shell
const mockImages = [
  'https://fastly.picsum.photos/id/10/2500/1667.jpg?hmac=J04WWC_ebchx3WwzbM-Z4_KC_LeLBWr5LZMaAkWkF68',
  'https://fastly.picsum.photos/id/11/2500/1667.jpg?hmac=xxjFJtAPgshYkysU_aqx2sZir-kIOjNR9vx0te7GycQ',
  'https://fastly.picsum.photos/id/12/2500/1667.jpg?hmac=Pe3284luVre9ZqNzv1jMFpLihFI6lwq7TPgMSsNXw2w'
];

async function main() {
  const renderer = new VideoRenderer();
  
  try {
    logger.info('Testing Video Renderer...');
    const outputPath = await renderer.renderVideo(mockScript, mockImages);
    logger.info(`Success! Video saved to: ${outputPath}`);
  } catch (error) {
    logger.error('Video Render Failed');
    console.error(error);
  }
}

main();

